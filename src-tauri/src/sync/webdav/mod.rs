pub(crate) mod rate_limit;
pub(crate) mod secret;
pub(crate) mod xml;
#[cfg(test)]
pub(crate) mod tests;

use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    net::IpAddr,
    str::FromStr,
    sync::{Arc, Mutex, OnceLock, PoisonError},
    time::{Duration, Instant},
};

use reqwest::{header, Method, Url};

use crate::user_error::UserError;

use super::backend::{is_ignored_name, is_safe_path, Backend, BackendError, Listed};
use rate_limit::{parse_retry_after, EtagToken, RateLimiter};
use xml::{decoded_segments, extract_href_path, parse_multistatus};

const MAX_RESPONSE_BYTES: usize = 16 * 1024 * 1024;
const MAX_REDIRECTS: usize = 5;
const MAX_BACKOFF_RETRIES: u32 = 2;
const MAX_INLINE_BACKOFF: Duration = Duration::from_secs(3);
const PAGINATE_PAGE_SIZE: usize = 500;
const MAX_PAGINATE_PAGES: usize = 20;

const PROPFIND_BODY: &str = r#"<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/></d:prop></d:propfind>"#;

fn guard<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

fn limiter_for(key: &str) -> Arc<RateLimiter> {
    static LIMITERS: OnceLock<Mutex<HashMap<String, Arc<RateLimiter>>>> = OnceLock::new();
    let map = LIMITERS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut locked = guard(map);
    locked
        .entry(key.to_string())
        .or_insert_with(|| Arc::new(RateLimiter::new()))
        .clone()
}

pub(crate) fn is_local_or_private_host(host: &str) -> bool {
    let stripped = host.trim().trim_start_matches('[').trim_end_matches(']');
    if stripped.is_empty() {
        return false;
    }
    if stripped.eq_ignore_ascii_case("localhost") {
        return true;
    }
    if let Ok(ip) = IpAddr::from_str(stripped) {
        return match ip {
            IpAddr::V4(v4) => v4.is_loopback() || v4.is_private() || v4.is_link_local(),
            IpAddr::V6(v6) => v6.is_loopback() || v6.is_unique_local() || v6.is_unicast_link_local(),
        };
    }
    let lower = stripped.to_ascii_lowercase();
    !lower.contains('.')
        || lower.ends_with(".local")
        || lower.ends_with(".lan")
        || lower.ends_with(".home.arpa")
        || lower.ends_with(".internal")
}

pub(crate) fn normalize_webdav_url(raw: &str) -> Result<Url, UserError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(UserError::new("sync.webdavUrl", "The WebDAV server URL is not valid."));
    }
    let mut url = Url::parse(trimmed)
        .map_err(|_| UserError::new("sync.webdavUrl", "The WebDAV server URL is not valid."))?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err(UserError::new(
            "sync.webdavUrlCredentials",
            "Do not include username or password in the WebDAV URL.",
        ));
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err(UserError::new("sync.webdavUrl", "The WebDAV server URL is not valid."));
    }
    let Some(host) = url.host_str().map(str::to_string) else {
        return Err(UserError::new("sync.webdavUrl", "The WebDAV server URL is not valid."));
    };
    match url.scheme() {
        "https" => {}
        "http" if is_local_or_private_host(&host) => {}
        _ => {
            return Err(UserError::new(
                "sync.webdavScheme",
                "Remote WebDAV URLs must start with https:// (http:// is allowed on LAN or localhost).",
            ));
        }
    }
    if host.eq_ignore_ascii_case("dav.jianguoyun.com") {
        let segments = decoded_segments(url.path());
        if segments.is_empty() || (segments.len() == 1 && segments[0].eq_ignore_ascii_case("dav")) {
            return Err(UserError::new(
                "sync.webdavNutstoreRoot",
                "Nutstore does not allow writing directly to /dav/; append a sync folder path.",
            ));
        }
    }
    if !url.path().ends_with('/') {
        let with_slash = format!("{}/", url.path());
        url.set_path(&with_slash);
    }
    Ok(url)
}

pub(crate) fn clean_webdav_url(raw: &str) -> Result<String, UserError> {
    let _ = normalize_webdav_url(raw)?;
    let trimmed = raw.trim();
    if trimmed.ends_with('/') {
        Ok(trimmed.to_string())
    } else {
        Ok(format!("{trimmed}/"))
    }
}

pub(crate) fn validate_credentials(username: &str, password: &str) -> Result<(String, String), UserError> {
    let user = username.trim().to_string();
    if user.is_empty() {
        return Err(UserError::new("sync.webdavNeedUsername", "Enter the WebDAV username."));
    }
    if password.is_empty() {
        return Err(UserError::new("sync.webdavNeedPassword", "Enter the WebDAV app password."));
    }
    Ok((user, password.to_string()))
}

fn build_client(host: &str) -> Result<reqwest::Client, UserError> {
    let mut builder = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("Fuyu/", env!("CARGO_PKG_VERSION")));
    if is_local_or_private_host(host) {
        builder = builder.no_proxy();
    } else if let Some(proxy) = crate::system::updater::reqwest_proxy()? {
        builder = builder.proxy(proxy);
    }
    builder.build().map_err(|error| {
        UserError::new("http.client", "Could not set up the connection.").detail(error.without_url())
    })
}

#[derive(Debug)]
enum DavFailure {
    Transient(UserError),
    Permanent(UserError),
}

impl DavFailure {
    fn into_user_error(self) -> UserError {
        match self {
            Self::Transient(error) | Self::Permanent(error) => error,
        }
    }
}

struct RawReply {
    final_url: Url,
    status: u16,
    etag: Option<EtagToken>,
    paginate_total: Option<usize>,
    bytes: Vec<u8>,
}

struct OnceReply {
    status: u16,
    location: Option<String>,
    retry_after: Option<Duration>,
    etag: Option<EtagToken>,
    paginate_total: Option<usize>,
    bytes: Vec<u8>,
}

pub(crate) struct WebdavBackend {
    base_url: Url,
    username: String,
    password: String,
    client: reqwest::Client,
    limiter: Arc<RateLimiter>,
    known_dirs: Mutex<BTreeSet<String>>,
    etags: Mutex<BTreeMap<String, EtagToken>>,
    last_error: Mutex<Option<UserError>>,
}

impl WebdavBackend {
    pub(crate) fn new(raw_url: &str, username: &str, password: &str) -> Result<Self, UserError> {
        let base_url = normalize_webdav_url(raw_url)?;
        let (username, password) = validate_credentials(username, password)?;
        let host = base_url.host_str().unwrap_or_default();
        let client = build_client(host)?;
        let limiter = limiter_for(&format!("{}|{}", base_url.as_str(), username));
        Ok(Self {
            base_url,
            username,
            password,
            client,
            limiter,
            known_dirs: Mutex::new(BTreeSet::new()),
            etags: Mutex::new(BTreeMap::new()),
            last_error: Mutex::new(None),
        })
    }

    #[cfg(test)]
    pub(crate) fn with_limiter(
        raw_url: &str,
        username: &str,
        password: &str,
        limiter: Arc<RateLimiter>,
    ) -> Result<Self, UserError> {
        let mut backend = Self::new(raw_url, username, password)?;
        backend.limiter = limiter;
        Ok(backend)
    }

    pub(crate) fn take_last_error(&self) -> Option<UserError> {
        guard(&self.last_error).take()
    }

    fn record_failure(&self, failure: DavFailure) -> BackendError {
        match failure {
            DavFailure::Transient(error) => {
                let text = error.to_string();
                *guard(&self.last_error) = Some(error);
                BackendError::Unavailable(text)
            }
            DavFailure::Permanent(error) => {
                let text = error.to_string();
                *guard(&self.last_error) = Some(error);
                BackendError::Failed(text)
            }
        }
    }

    fn redact(&self, error: UserError) -> UserError {
        error.redact(&self.password)
    }

    fn resolve_url(&self, rel_path: &str, as_dir: bool) -> Result<Url, DavFailure> {
        if !is_safe_path(rel_path) {
            return Err(DavFailure::Permanent(UserError::from(format!(
                "\"{rel_path}\" is not a sync path."
            ))));
        }
        let mut url = self.base_url.clone();
        {
            let Ok(mut segments) = url.path_segments_mut() else {
                return Err(DavFailure::Permanent(UserError::new(
                    "sync.webdavUrl",
                    "The WebDAV server URL is not valid.",
                )));
            };
            segments.pop_if_empty();
            for part in rel_path.split('/') {
                segments.push(part);
            }
            if as_dir {
                segments.push("");
            }
        }
        Ok(url)
    }

    async fn send_once(
        &self,
        method: &Method,
        url: &Url,
        extra_headers: &[(&str, String)],
        body: Option<&[u8]>,
    ) -> Result<OnceReply, DavFailure> {
        if self.limiter.acquire(Instant::now()).is_err() {
            return Err(DavFailure::Transient(UserError::new(
                "sync.webdavRateLimited",
                "Too many WebDAV requests; paused to stay within the 600 requests / 30 min limit.",
            )));
        }
        let mut request = self
            .client
            .request(method.clone(), url.clone())
            .basic_auth(&self.username, Some(&self.password))
            .header(header::ACCEPT_ENCODING, "identity");
        for (name, value) in extra_headers {
            request = request.header(*name, value);
        }
        if let Some(bytes) = body {
            request = request.body(bytes.to_vec());
        }
        let response = request.send().await.map_err(|error| {
            DavFailure::Transient(self.redact(
                UserError::new("sync.webdavOffline", "Could not reach the WebDAV server.")
                    .detail(error.without_url()),
            ))
        })?;
        let status = response.status().as_u16();
        let location = response
            .headers()
            .get(header::LOCATION)
            .and_then(|val| val.to_str().ok())
            .map(str::to_string);
        let retry_after = parse_retry_after(
            response
                .headers()
                .get(header::RETRY_AFTER)
                .and_then(|val| val.to_str().ok()),
        );
        let etag = response
            .headers()
            .get(header::ETAG)
            .and_then(|val| val.to_str().ok())
            .and_then(EtagToken::parse);
        let paginate_total = response
            .headers()
            .get("x-nc-paginate-total")
            .and_then(|val| val.to_str().ok())
            .and_then(|val| val.trim().parse::<usize>().ok());

        if !(200..300).contains(&status) {
            return Ok(OnceReply {
                status,
                location,
                retry_after,
                etag,
                paginate_total,
                bytes: Vec::new(),
            });
        }
        let bytes = response.bytes().await.map_err(|error| {
            DavFailure::Transient(self.redact(
                UserError::new("sync.webdavOffline", "Could not read from the WebDAV server.")
                    .detail(error.without_url()),
            ))
        })?;
        if bytes.len() > MAX_RESPONSE_BYTES {
            return Err(DavFailure::Permanent(
                UserError::new("net.tooLarge", "The WebDAV server sent more than expected.")
                    .arg("service", "WebDAV"),
            ));
        }
        Ok(OnceReply {
            status,
            location,
            retry_after,
            etag,
            paginate_total,
            bytes: bytes.to_vec(),
        })
    }

    async fn request(
        &self,
        method_str: &str,
        initial_url: &Url,
        extra_headers: &[(&str, String)],
        body: Option<&[u8]>,
    ) -> Result<RawReply, DavFailure> {
        let method = Method::from_bytes(method_str.as_bytes()).map_err(|error| {
            DavFailure::Permanent(UserError::new("internal", "Something went wrong inside the island.").detail(error))
        })?;
        let mut current = initial_url.clone();
        let mut hops = 0;

        loop {
            let mut attempt = 0;
            let OnceReply { status, location, etag, paginate_total, bytes, .. } = loop {
                let once = self.send_once(&method, &current, extra_headers, body).await?;
                if matches!(once.status, 429 | 503) {
                    let wait = RateLimiter::compute_backoff(once.retry_after, attempt);
                    if attempt < MAX_BACKOFF_RETRIES && wait <= MAX_INLINE_BACKOFF {
                        attempt += 1;
                        let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(wait)).await;
                        continue;
                    }
                    let cooldown = once.retry_after.unwrap_or(Duration::from_secs(30));
                    self.limiter.set_cooldown(Instant::now(), cooldown);
                    return Err(DavFailure::Transient(UserError::new(
                        "sync.webdavRateLimited",
                        "The WebDAV server rate-limited requests; paused to cool down.",
                    )));
                }
                break once;
            };

            if matches!(status, 301 | 302 | 303 | 307 | 308) && hops < MAX_REDIRECTS {
                if let Some(loc) = location.as_deref() {
                    if let Ok(next) = current.join(loc.trim()) {
                        let same_origin = next.scheme() == current.scheme()
                            && next.host_str() == current.host_str()
                            && next.port_or_known_default() == current.port_or_known_default();
                        if same_origin {
                            current = next;
                            hops += 1;
                            continue;
                        }
                    }
                }
            }

            if matches!(status, 401 | 403) {
                return Err(DavFailure::Permanent(UserError::new(
                    "sync.webdavAuth",
                    "The WebDAV username or app password was rejected.",
                )));
            }

            return Ok(RawReply { final_url: current, status, etag, paginate_total, bytes });
        }
    }

    fn status_failure(status: u16) -> DavFailure {
        if (500..600).contains(&status) {
            DavFailure::Transient(
                UserError::new("sync.webdavStatus", format!("The WebDAV server answered {status}."))
                    .arg("status", status),
            )
        } else {
            DavFailure::Permanent(
                UserError::new("sync.webdavStatus", format!("The WebDAV server answered {status}."))
                    .arg("status", status),
            )
        }
    }

    async fn propfind_collection(&self, url: &Url, depth: &str, extra: &[(&str, String)]) -> Result<Option<(Url, Vec<xml::DavEntry>, Option<usize>)>, DavFailure> {
        let mut headers = Vec::with_capacity(2 + extra.len());
        headers.push(("Depth", depth.to_string()));
        headers.push(("Content-Type", "application/xml; charset=utf-8".to_string()));
        headers.extend_from_slice(extra);
        let reply = self
            .request("PROPFIND", url, &headers, Some(PROPFIND_BODY.as_bytes()))
            .await?;
        if reply.status == 404 {
            return Ok(None);
        }
        if !(200..300).contains(&reply.status) {
            return Err(Self::status_failure(reply.status));
        }
        let body_str = String::from_utf8_lossy(&reply.bytes);
        let Some(entries) = parse_multistatus(&body_str) else {
            return Err(DavFailure::Permanent(UserError::new(
                "sync.webdavInvalidXml",
                "The server response is not a valid WebDAV Multi-Status XML document.",
            )));
        };
        Ok(Some((reply.final_url, entries, reply.paginate_total)))
    }

    fn parent_collection_url(url: &Url) -> Option<Url> {
        let segments = decoded_segments(url.path());
        if segments.is_empty() {
            return None;
        }
        let host = url.host_str().unwrap_or_default();
        if host.eq_ignore_ascii_case("dav.jianguoyun.com") && segments.len() <= 2 {
            return None;
        }
        let mut parent = url.clone();
        {
            let mut path_segs = parent.path_segments_mut().ok()?;
            path_segs.pop_if_empty();
            path_segs.pop();
            path_segs.push("");
        }
        (parent != *url).then_some(parent)
    }

    pub(crate) async fn test_connection(&self) -> Result<(), UserError> {
        match self.propfind_collection(&self.base_url, "0", &[]).await {
            Ok(Some((_, entries, _))) => {
                if entries.iter().any(|entry| entry.is_collection) {
                    Ok(())
                } else {
                    Err(UserError::new(
                        "sync.webdavInvalidXml",
                        "The address does not point to a WebDAV folder.",
                    ))
                }
            }
            Ok(None) => {
                if let Some(parent) = Self::parent_collection_url(&self.base_url) {
                    if let Ok(Some((_, entries, _))) = self.propfind_collection(&parent, "0", &[]).await {
                        if entries.iter().any(|entry| entry.is_collection) {
                            return Ok(());
                        }
                    }
                }
                Err(UserError::new(
                    "sync.webdavNotFound",
                    "The WebDAV folder was not found on the server (404).",
                ))
            }
            Err(failure) => Err(failure.into_user_error()),
        }
    }

    async fn mkcol_one(&self, url: &Url) -> Result<(), DavFailure> {
        let reply = self.request("MKCOL", url, &[], None).await?;
        match reply.status {
            200..=299 | 405 => Ok(()),
            409 => {
                if let Some((_, entries, _)) = self.propfind_collection(url, "0", &[]).await? {
                    if entries.iter().any(|entry| entry.is_collection) {
                        return Ok(());
                    }
                }
                Err(DavFailure::Permanent(UserError::new(
                    "sync.webdavNotFound",
                    "The parent WebDAV folder does not exist on the server.",
                )))
            }
            404 => Err(DavFailure::Permanent(UserError::new(
                "sync.webdavNotFound",
                "The WebDAV folder was not found on the server (404).",
            ))),
            other => Err(Self::status_failure(other)),
        }
    }

    async fn ensure_base_async(&self) -> Result<(), DavFailure> {
        if guard(&self.known_dirs).contains("") {
            return Ok(());
        }
        match self.propfind_collection(&self.base_url, "0", &[]).await? {
            Some((_, entries, _)) => {
                if !entries.iter().any(|entry| entry.is_collection) {
                    return Err(DavFailure::Permanent(UserError::new(
                        "sync.webdavInvalidXml",
                        "The address does not point to a WebDAV folder.",
                    )));
                }
            }
            None => {
                self.mkcol_one(&self.base_url).await?;
            }
        }
        guard(&self.known_dirs).insert(String::new());
        Ok(())
    }

    async fn ensure_parent_dirs(&self, rel_file_path: &str, force: bool) -> Result<(), DavFailure> {
        self.ensure_base_async().await?;
        let parts: Vec<&str> = rel_file_path.split('/').collect();
        if parts.len() <= 1 {
            return Ok(());
        }
        let mut prefix = String::new();
        for dir_part in &parts[..parts.len() - 1] {
            if !prefix.is_empty() {
                prefix.push('/');
            }
            prefix.push_str(dir_part);
            let already_known = !force && guard(&self.known_dirs).contains(&prefix);
            if already_known {
                continue;
            }
            let dir_url = self.resolve_url(&prefix, true)?;
            self.mkcol_one(&dir_url).await?;
            guard(&self.known_dirs).insert(prefix.clone());
        }
        Ok(())
    }

    async fn list_async(&self, dir: &str) -> Result<Vec<Listed>, DavFailure> {
        let dir_url = self.resolve_url(dir, true)?;
        let Some((final_url, mut all_entries, paginate_total)) =
            self.propfind_collection(&dir_url, "1", &[]).await?
        else {
            return Ok(Vec::new());
        };

        if let Some(total) = paginate_total.filter(|total| *total > all_entries.len()) {
            let mut offset = all_entries.len().saturating_sub(1).max(1);
            let mut pages = 0;
            while offset < total && pages < MAX_PAGINATE_PAGES {
                let extra = [
                    ("X-NC-Paginate", "true".to_string()),
                    ("X-NC-Paginate-Offset", offset.to_string()),
                    ("X-NC-Paginate-Count", PAGINATE_PAGE_SIZE.to_string()),
                ];
                let Some((_, batch, _)) = self.propfind_collection(&final_url, "1", &extra).await? else {
                    break;
                };
                if batch.len() <= 1 {
                    break;
                }
                offset += batch.len() - 1;
                all_entries.extend(batch);
                pages += 1;
            }
        }

        let target_segments = decoded_segments(final_url.path());
        let mut by_name: BTreeMap<String, bool> = BTreeMap::new();
        for entry in all_entries {
            let (decoded_path, trailing_slash) = extract_href_path(&entry.href);
            let segments: Vec<&str> = decoded_path.split('/').filter(|part| !part.is_empty()).collect();
            if segments.len() != target_segments.len() + 1 {
                continue;
            }
            if segments
                .iter()
                .zip(target_segments.iter())
                .any(|(left, right)| *left != right.as_str())
            {
                continue;
            }
            let name = segments[target_segments.len()].to_string();
            if is_ignored_name(&name) {
                continue;
            }
            let is_dir = entry.is_collection || trailing_slash;
            if !is_dir {
                if let Some(raw_etag) = &entry.etag {
                    if let Some(parsed) = EtagToken::parse(raw_etag) {
                        let child_rel = format!("{}/{}", dir.trim_end_matches('/'), name);
                        guard(&self.etags).insert(child_rel, parsed);
                    }
                }
            }
            by_name
                .entry(name)
                .and_modify(|existing| *existing |= is_dir)
                .or_insert(is_dir);
        }

        Ok(by_name
            .into_iter()
            .map(|(name, is_dir)| Listed { name, is_dir })
            .collect())
    }

    async fn read_async(&self, path: &str) -> Result<Option<Vec<u8>>, DavFailure> {
        let file_url = self.resolve_url(path, false)?;
        let reply = self.request("GET", &file_url, &[], None).await?;
        match reply.status {
            200..=299 => {
                if let Some(etag) = reply.etag {
                    guard(&self.etags).insert(path.to_string(), etag);
                }
                Ok(Some(reply.bytes))
            }
            404 => {
                guard(&self.etags).remove(path);
                Ok(None)
            }
            other => Err(Self::status_failure(other)),
        }
    }

    async fn put_with_optional_etag(
        &self,
        file_url: &Url,
        bytes: &[u8],
        if_match: Option<&str>,
    ) -> Result<RawReply, DavFailure> {
        let mut headers = vec![("Content-Type", "application/json".to_string())];
        if let Some(cond) = if_match {
            headers.push(("If-Match", cond.to_string()));
        }
        self.request("PUT", file_url, &headers, Some(bytes)).await
    }

    async fn write_async(&self, path: &str, bytes: &[u8]) -> Result<(), DavFailure> {
        self.ensure_parent_dirs(path, false).await?;
        let file_url = self.resolve_url(path, false)?;
        let cached_etag = (path == super::layout::META_FILE)
            .then(|| guard(&self.etags).get(path).cloned())
            .flatten();

        let candidates = cached_etag
            .as_ref()
            .map(EtagToken::if_match_candidates)
            .unwrap_or_default();

        let mut reply = self
            .put_with_optional_etag(&file_url, bytes, candidates.first().map(String::as_str))
            .await?;

        if matches!(reply.status, 400 | 412) && candidates.len() > 1 {
            reply = self
                .put_with_optional_etag(&file_url, bytes, Some(candidates[1].as_str()))
                .await?;
        }

        if matches!(reply.status, 404 | 409) {
            self.ensure_parent_dirs(path, true).await?;
            reply = self.put_with_optional_etag(&file_url, bytes, None).await?;
        }

        if (200..300).contains(&reply.status) {
            if let Some(etag) = reply.etag {
                guard(&self.etags).insert(path.to_string(), etag);
            }
            return Ok(());
        }

        if reply.status == 412
            && path == super::layout::META_FILE
            && self.read_async(path).await?.is_some()
        {
            return Ok(());
        }

        Err(Self::status_failure(reply.status))
    }

    async fn delete_async(&self, path: &str) -> Result<(), DavFailure> {
        let file_url = self.resolve_url(path, false)?;
        let reply = self.request("DELETE", &file_url, &[], None).await?;
        match reply.status {
            200..=299 | 404 => {
                guard(&self.etags).remove(path);
                Ok(())
            }
            other => Err(Self::status_failure(other)),
        }
    }
}

impl Backend for WebdavBackend {
    fn check(&self) -> Result<(), BackendError> {
        tauri::async_runtime::block_on(self.ensure_base_async()).map_err(|failure| self.record_failure(failure))
    }

    fn list(&self, dir: &str) -> Result<Vec<Listed>, BackendError> {
        tauri::async_runtime::block_on(self.list_async(dir)).map_err(|failure| self.record_failure(failure))
    }

    fn read(&self, path: &str) -> Result<Option<Vec<u8>>, BackendError> {
        tauri::async_runtime::block_on(self.read_async(path)).map_err(|failure| self.record_failure(failure))
    }

    fn write(&self, path: &str, bytes: &[u8]) -> Result<(), BackendError> {
        tauri::async_runtime::block_on(self.write_async(path, bytes)).map_err(|failure| self.record_failure(failure))
    }

    fn delete(&self, path: &str) -> Result<(), BackendError> {
        tauri::async_runtime::block_on(self.delete_async(path)).map_err(|failure| self.record_failure(failure))
    }
}
