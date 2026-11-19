use std::collections::{BTreeMap, BTreeSet};
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use plugin_base::{Event, HostState};
use serde_json::Value;
use tauri::http::{header, HeaderValue, Method, Request, Response, StatusCode};

pub(crate) const SCHEME: &str = "fuyu-plugin";
pub(crate) const CSP: &str = "default-src 'none'; script-src 'self' fuyu-plugin: http://fuyu-plugin.localhost; style-src 'self' 'unsafe-inline' fuyu-plugin: http://fuyu-plugin.localhost; img-src 'self' data: blob: fuyu-plugin: http://fuyu-plugin.localhost https:; font-src 'self' data: fuyu-plugin: http://fuyu-plugin.localhost; media-src 'self' data: blob: fuyu-plugin: http://fuyu-plugin.localhost";
const CLIENTS: &str = "clients";
const PACKAGES: &str = "packages";
const PRIVATE_DIR: &str = "data";
const DEV_DIR: &str = "dev";
const DEV_ID_SEGMENTS: [usize; 2] = [1, 2];
const RESERVED_DIRS: [&str; 5] = ["data", "packages", "__shared", "dev", "builtin"];
const PRIVATE_FILES: [&str; 3] = ["plugins.yml", "safe-mode.json", "bisect.json"];

const SHIMS: [(&str, &str); 2] = [
    ("__shared/react.js", include_str!("../../../packages/plugin-base/src/client/shims/react.js")),
    ("__shared/react-jsx-runtime.js", include_str!("../../../packages/plugin-base/src/client/shims/react-jsx-runtime.js")),
];

fn mime(path: &str) -> &'static str {
    match path.rsplit('.').next().map(str::to_ascii_lowercase).as_deref() {
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json" | "map") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        _ => "application/octet-stream",
    }
}

fn decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            out.push(u8::from_str_radix(value.get(index + 1..index + 3)?, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

fn relative_path(uri_path: &str) -> Option<String> {
    clean(decode(uri_path.trim_start_matches('/'))?)
}

fn clean(path: String) -> Option<String> {
    let parts = Path::new(&path).components().collect::<Vec<_>>();
    if path.is_empty() || path.contains('\\') || path.contains(':') || path.split('/').any(str::is_empty) || parts.iter().any(|part| !matches!(part, Component::Normal(_))) {
        return None;
    }
    Some(path)
}

fn private_file(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    PRIVATE_FILES.iter().any(|file| name == *file || name.starts_with(&format!("{file}.")))
}

fn reserved_dir(name: &str) -> bool {
    RESERVED_DIRS.iter().any(|dir| name.eq_ignore_ascii_case(dir))
}

fn denied(relative: &str) -> bool {
    match relative.split_once('/') {
        None => private_file(relative),
        Some((dir, _)) => dir.eq_ignore_ascii_case(PRIVATE_DIR),
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
struct Listed {
    dirs: BTreeSet<String>,
    files: BTreeSet<String>,
}

impl Listed {
    const EMPTY: Self = Self { dirs: BTreeSet::new(), files: BTreeSet::new() };

    fn add(&mut self, path: &str) {
        match path.split_once('/') {
            None => {
                self.files.insert(path.to_owned());
            }
            Some((dir, _)) => {
                self.dirs.insert(dir.to_owned());
            }
        }
    }

    fn contains(&self, relative: &str) -> bool {
        match relative.split_once('/') {
            None => self.files.contains(relative),
            Some((dir, _)) => self.dirs.contains(dir),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Mount {
    root: PathBuf,
    listed: Listed,
}

impl Mount {
    fn permits(&self, inner: &str) -> bool {
        !denied(inner) && self.listed.contains(inner)
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
struct Allowed {
    listed: Listed,
    mounts: BTreeMap<String, Mount>,
}

fn dev_prefix(prefix: &str) -> Option<String> {
    let prefix = clean(prefix.to_owned())?;
    let id = prefix.strip_prefix(DEV_DIR)?.strip_prefix('/')?;
    DEV_ID_SEGMENTS.contains(&id.split('/').count()).then_some(prefix)
}

fn inner_of<'a>(relative: &'a str, prefix: &str) -> Option<&'a str> {
    relative.strip_prefix(prefix)?.strip_prefix('/').filter(|inner| !inner.is_empty())
}

impl Allowed {
    const EMPTY: Self = Self { listed: Listed::EMPTY, mounts: BTreeMap::new() };

    #[cfg(test)]
    fn from_paths<'a>(paths: impl IntoIterator<Item = &'a str>) -> Self {
        Self::from_parts([], paths)
    }

    fn from_parts<'a>(roots: impl IntoIterator<Item = (&'a str, &'a str)>, paths: impl IntoIterator<Item = &'a str>) -> Self {
        let mut allowed = Self::default();
        for (prefix, dir) in roots {
            if let (Some(prefix), true) = (dev_prefix(prefix), Path::new(dir).is_absolute()) {
                allowed.mounts.insert(prefix, Mount { root: PathBuf::from(dir), listed: Listed::default() });
            }
        }
        for path in paths.into_iter().filter_map(|path| clean(path.to_owned())).filter(|path| !denied(path)) {
            if let Some((prefix, inner)) = allowed.mount_key(&path) {
                if let Some(mount) = allowed.mounts.get_mut(&prefix) {
                    mount.listed.add(&inner);
                }
                continue;
            }
            match path.split_once('/') {
                Some((dir, _)) if reserved_dir(dir) => {}
                _ => allowed.listed.add(&path),
            }
        }
        allowed
    }

    fn mount_key(&self, relative: &str) -> Option<(String, String)> {
        self.mounts
            .keys()
            .filter_map(|prefix| Some((prefix.clone(), inner_of(relative, prefix)?.to_owned())))
            .max_by_key(|(prefix, _)| prefix.len())
    }

    fn mount(&self, relative: &str) -> Option<(&Mount, String)> {
        let (prefix, inner) = self.mount_key(relative)?;
        Some((self.mounts.get(&prefix)?, inner))
    }

    fn permits(&self, relative: &str) -> bool {
        if denied(relative) {
            return false;
        }
        match relative.split_once('/') {
            None => self.listed.contains(relative),
            Some((dir, _)) => dir == PACKAGES || self.listed.contains(relative),
        }
    }
}

static REGISTERED: Mutex<Allowed> = Mutex::new(Allowed::EMPTY);

fn registered() -> Allowed {
    REGISTERED.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

fn register(allowed: Allowed) {
    *REGISTERED.lock().unwrap_or_else(PoisonError::into_inner) = allowed;
}

fn client_paths(params: &Value) -> Allowed {
    let roots = params["roots"].as_array().into_iter().flatten().filter_map(|root| Some((root["prefix"].as_str()?, root["dir"].as_str()?)));
    Allowed::from_parts(roots, params["paths"].as_array().into_iter().flatten().filter_map(Value::as_str))
}

pub(crate) fn observe(event: &Event) {
    match event {
        Event::Notification { method, params } if method == CLIENTS => register(client_paths(params)),
        Event::State(HostState::Ready { .. }) | Event::Notification { .. } | Event::Stderr(_) => {}
        Event::State(_) => register(Allowed::default()),
    }
}

fn inside(root: &Path, file: &Path) -> Option<String> {
    let parts = file.strip_prefix(root).ok()?.components().map(|part| part.as_os_str().to_str()).collect::<Option<Vec<_>>>()?;
    (!parts.is_empty()).then(|| parts.join("/"))
}

fn locate(root: &Path, relative: &str, allowed: &Allowed) -> Option<PathBuf> {
    if !allowed.permits(relative) {
        return None;
    }
    let root = std::fs::canonicalize(root).ok()?;
    let file = std::fs::canonicalize(root.join(relative)).ok()?;
    let real = inside(&root, &file)?;
    (allowed.permits(&real) && file.is_file()).then_some(file)
}

fn locate_mounted(data_root: &Path, mount: &Mount, inner: &str) -> Option<PathBuf> {
    if !mount.permits(inner) {
        return None;
    }
    let root = std::fs::canonicalize(&mount.root).ok()?;
    let file = std::fs::canonicalize(root.join(inner)).ok()?;
    let real = inside(&root, &file)?;
    if std::fs::canonicalize(data_root).is_ok_and(|data| file.starts_with(data)) {
        return None;
    }
    (mount.permits(&real) && file.is_file()).then_some(file)
}

fn respond_with(status: StatusCode, content_type: &'static str, body: Vec<u8>, head: bool) -> Response<Vec<u8>> {
    let length = body.len();
    let mut response = Response::new(if head { Vec::new() } else { body });
    *response.status_mut() = status;
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    headers.insert(header::CONTENT_SECURITY_POLICY, HeaderValue::from_static(CSP));
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    if let Ok(value) = HeaderValue::from_str(&length.to_string()) {
        headers.insert(header::CONTENT_LENGTH, value);
    }
    response
}

fn missing(head: bool) -> Response<Vec<u8>> {
    respond_with(StatusCode::NOT_FOUND, "text/plain; charset=utf-8", b"not found".to_vec(), head)
}

pub(crate) fn respond(root: Option<&Path>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    serve(root, &registered(), request)
}

fn serve(root: Option<&Path>, allowed: &Allowed, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let head = request.method() == Method::HEAD;
    if request.method() != Method::GET && !head {
        return respond_with(StatusCode::METHOD_NOT_ALLOWED, "text/plain; charset=utf-8", Vec::new(), head);
    }
    let Some(root) = root else { return missing(head) };
    let Some(relative) = relative_path(request.uri().path()) else { return missing(head) };
    if let Some((_, text)) = SHIMS.iter().find(|(path, _)| *path == relative) {
        return respond_with(StatusCode::OK, mime(&relative), text.as_bytes().to_vec(), head);
    }
    let found = match allowed.mount(&relative) {
        Some((mount, inner)) => locate_mounted(root, mount, &inner),
        None => locate(root, &relative, allowed),
    };
    match found.map(std::fs::read) {
        Some(Ok(bytes)) => respond_with(StatusCode::OK, mime(&relative), bytes, head),
        _ => missing(head),
    }
}

#[cfg(test)]
#[path = "protocol_tests.rs"]
mod tests;
