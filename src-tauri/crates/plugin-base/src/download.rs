use std::{
    fmt, fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use sha2::{Digest, Sha256};

use crate::{node::NodeVersion, unpack::unpack};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveKind {
    Zip,
    TarXz,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeArchive {
    pub file: String,
    pub sha256: String,
    pub kind: ArchiveKind,
    pub exe: String,
}

impl NodeArchive {
    pub fn folder(&self) -> &str {
        self.file.trim_end_matches(".zip").trim_end_matches(".tar.xz")
    }
}

#[derive(Debug, Clone)]
pub struct NodeDownload {
    pub version: NodeVersion,
    pub archive: NodeArchive,
    pub sources: Vec<String>,
    pub proxy: Option<String>,
    pub max_bytes: u64,
    pub connect_timeout: Duration,
    pub read_timeout: Duration,
}

impl NodeDownload {
    pub fn url(&self, source: &str) -> String {
        format!("{}/v{}/{}", source.trim_end_matches('/'), self.version, self.archive.file)
    }

    pub fn install_dir(&self, data_dir: &Path) -> PathBuf {
        runtime_dir(data_dir).join(format!("node-v{}", self.version))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Progress<'a> {
    pub url: &'a str,
    pub downloaded: u64,
    pub total: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Attempt {
    pub url: String,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DownloadError {
    Unsupported { os: String, arch: String },
    Disk { action: &'static str, path: PathBuf, error: String },
    Sources(Vec<Attempt>),
    Unpack(String),
}

impl fmt::Display for DownloadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unsupported { os, arch } => write!(formatter, "Node has no build for {os} on {arch}"),
            Self::Disk { action, path, error } => write!(formatter, "could not {action} {}: {error}", path.display()),
            Self::Sources(attempts) if attempts.is_empty() => write!(formatter, "no download address to try"),
            Self::Sources(attempts) => {
                let lines: Vec<String> = attempts.iter().map(|attempt| format!("{}: {}", attempt.url, attempt.reason)).collect();
                write!(formatter, "could not download Node: {}", lines.join("; "))
            }
            Self::Unpack(reason) => write!(formatter, "could not unpack Node: {reason}"),
        }
    }
}

impl std::error::Error for DownloadError {}

const MARKER: &str = ".fuyu-sha256";
const STAGING: &str = ".download-";

pub fn runtime_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("runtime")
}

pub fn installed_node(data_dir: &Path, download: &NodeDownload) -> Option<PathBuf> {
    let dir = download.install_dir(data_dir);
    let exe = dir.join(&download.archive.exe);
    let marker = fs::read_to_string(dir.join(MARKER)).ok()?;
    (marker.trim().eq_ignore_ascii_case(&download.archive.sha256) && exe.is_file()).then_some(exe)
}

pub fn prepare_node(data_dir: &Path, download: &NodeDownload, progress: &mut dyn FnMut(Progress)) -> Result<PathBuf, DownloadError> {
    if let Some(exe) = installed_node(data_dir, download) {
        return Ok(exe);
    }
    let runtime = runtime_dir(data_dir);
    fs::create_dir_all(&runtime).map_err(|error| disk("create", &runtime, error))?;
    remove_stale_staging(&runtime);
    let staging = Staging::new(&runtime)?;
    let archive = staging.path.join("archive");
    let client = client(download)?;
    let mut attempts = Vec::new();
    let mut fetched = false;
    for source in &download.sources {
        let url = download.url(source);
        match fetch(&client, &url, &archive, download, progress) {
            Ok(()) => {
                fetched = true;
                break;
            }
            Err(reason) => {
                let _ = fs::remove_file(&archive);
                attempts.push(Attempt { url, reason });
            }
        }
    }
    if !fetched {
        return Err(DownloadError::Sources(attempts));
    }
    let unpacked = staging.path.join("unpacked");
    fs::create_dir_all(&unpacked).map_err(|error| disk("create", &unpacked, error))?;
    unpack(&archive, download.archive.kind, &unpacked).map_err(DownloadError::Unpack)?;
    let tree = unpacked.join(download.archive.folder());
    if !tree.join(&download.archive.exe).is_file() {
        return Err(DownloadError::Unpack(format!("{} has no {}/{}", download.archive.file, download.archive.folder(), download.archive.exe)));
    }
    let marker = tree.join(MARKER);
    fs::write(&marker, &download.archive.sha256).map_err(|error| disk("write", &marker, error))?;
    let target = download.install_dir(data_dir);
    if target.exists() {
        let old = staging.path.join("old");
        fs::rename(&target, &old).map_err(|error| disk("move away", &target, error))?;
    }
    fs::rename(&tree, &target).map_err(|error| disk("move into place", &target, error))?;
    drop(staging);
    remove_other_versions(&runtime, &target);
    installed_node(data_dir, download).ok_or_else(|| DownloadError::Unpack(format!("{} is missing after unpacking", target.join(&download.archive.exe).display())))
}

fn client(download: &NodeDownload) -> Result<reqwest::blocking::Client, DownloadError> {
    let mut builder = reqwest::blocking::Client::builder()
        .connect_timeout(download.connect_timeout)
        .timeout(download.read_timeout)
        .user_agent(concat!("Fuyu-plugin-base/", env!("CARGO_PKG_VERSION")));
    if let Some(proxy) = &download.proxy {
        let usable = reqwest::Proxy::all(proxy).map_err(|error| DownloadError::Sources(vec![Attempt { url: redact_proxy(proxy), reason: scrub(&format!("not a usable proxy: {}", error.without_url()), Some(proxy)) }]))?;
        builder = builder.proxy(usable);
    }
    builder.build().map_err(|error| DownloadError::Sources(vec![Attempt { url: String::new(), reason: scrub(&format!("could not set up HTTP: {error}"), download.proxy.as_deref()) }]))
}

fn userinfo(proxy: &str) -> Option<(usize, usize)> {
    let start = proxy.find("://").map_or(0, |at| at + 3);
    let rest = &proxy[start..];
    let authority = &rest[..rest.find(['/', '?', '#']).unwrap_or(rest.len())];
    authority.rfind('@').map(|at| (start, start + at))
}

fn redact_proxy(proxy: &str) -> String {
    match userinfo(proxy) {
        Some((start, end)) => format!("{}***{}", &proxy[..start], &proxy[end..]),
        None => proxy.to_owned(),
    }
}

fn scrub(text: &str, proxy: Option<&str>) -> String {
    let Some(proxy) = proxy else { return text.to_owned() };
    let Some((start, end)) = userinfo(proxy) else { return text.to_owned() };
    let secret = &proxy[start..end];
    let mut scrubbed = text.replace(proxy, &redact_proxy(proxy));
    if !secret.is_empty() {
        scrubbed = scrubbed.replace(secret, "***");
        if let Some((_, password)) = secret.split_once(':').filter(|(_, password)| !password.is_empty()) {
            scrubbed = scrubbed.replace(password, "***");
        }
    }
    scrubbed
}

fn fetch(client: &reqwest::blocking::Client, url: &str, archive: &Path, download: &NodeDownload, progress: &mut dyn FnMut(Progress)) -> Result<(), String> {
    let mut response = client.get(url).send().map_err(|error| scrub(&describe_http(&error), download.proxy.as_deref()))?;
    if !response.status().is_success() {
        return Err(format!("answered HTTP {}", response.status().as_u16()));
    }
    let total = response.content_length();
    if total.is_some_and(|total| total > download.max_bytes) {
        return Err(format!("is larger than {} bytes", download.max_bytes));
    }
    let mut file = fs::File::create(archive).map_err(|error| format!("could not write {}: {error}", archive.display()))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;
    let mut buffer = vec![0u8; 64 * 1024];
    progress(Progress { url, downloaded, total });
    loop {
        let read = response.read(&mut buffer).map_err(|error| format!("broke off after {downloaded} bytes: {error}"))?;
        if read == 0 {
            break;
        }
        let chunk = &buffer[..read];
        downloaded += read as u64;
        if downloaded > download.max_bytes {
            return Err(format!("is larger than {} bytes", download.max_bytes));
        }
        hasher.update(chunk);
        file.write_all(chunk).map_err(|error| format!("could not write {}: {error}", archive.display()))?;
        progress(Progress { url, downloaded, total });
    }
    if let Some(total) = total.filter(|total| *total != downloaded) {
        return Err(format!("ended after {downloaded} of {total} bytes"));
    }
    file.sync_all().map_err(|error| format!("could not write {}: {error}", archive.display()))?;
    let actual: String = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect();
    if !actual.eq_ignore_ascii_case(&download.archive.sha256) {
        return Err(format!("SHA-256 is {actual}, expected {}", download.archive.sha256.to_ascii_lowercase()));
    }
    Ok(())
}

fn describe_http(error: &reqwest::Error) -> String {
    let mut text = error.to_string();
    let mut source = std::error::Error::source(error);
    while let Some(inner) = source {
        text.push_str(": ");
        text.push_str(&inner.to_string());
        source = inner.source();
    }
    text
}

struct Staging {
    path: PathBuf,
}

impl Staging {
    fn new(runtime: &Path) -> Result<Self, DownloadError> {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|elapsed| elapsed.as_nanos()).unwrap_or_default();
        let path = runtime.join(format!("{STAGING}{}-{nanos}", std::process::id()));
        fs::create_dir_all(&path).map_err(|error| disk("create", &path, error))?;
        Ok(Self { path })
    }
}

impl Drop for Staging {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn remove_stale_staging(runtime: &Path) {
    let Ok(entries) = fs::read_dir(runtime) else { return };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().starts_with(STAGING) {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

fn remove_other_versions(runtime: &Path, keep: &Path) {
    let Ok(entries) = fs::read_dir(runtime) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path != keep && path.is_dir() && entry.file_name().to_string_lossy().starts_with("node-v") {
            let _ = fs::remove_dir_all(path);
        }
    }
}

fn disk(action: &'static str, path: &Path, error: std::io::Error) -> DownloadError {
    DownloadError::Disk { action, path: path.to_path_buf(), error: error.to_string() }
}

#[cfg(test)]
mod tests {
    use super::{redact_proxy, scrub};

    #[test]
    fn a_proxy_never_shows_its_user_or_password() {
        assert_eq!(redact_proxy("http://alice:s3cret@127.0.0.1:7890"), "http://***@127.0.0.1:7890");
        assert_eq!(redact_proxy("alice:s3cret@proxy.example:8080/path@x"), "***@proxy.example:8080/path@x");
        assert_eq!(redact_proxy("http://127.0.0.1:7890"), "http://127.0.0.1:7890");
        let text = "error sending request: tunnel to http://alice:s3cret@127.0.0.1:7890 failed for alice:s3cret, password s3cret";
        let scrubbed = scrub(text, Some("http://alice:s3cret@127.0.0.1:7890"));
        assert!(!scrubbed.contains("alice") && !scrubbed.contains("s3cret"), "{scrubbed}");
        assert!(scrubbed.contains("127.0.0.1:7890"), "the host stays, it helps to see which proxy failed");
        assert_eq!(scrub("plain", None), "plain");
        assert_eq!(scrub("http://127.0.0.1:7890 refused", Some("http://127.0.0.1:7890")), "http://127.0.0.1:7890 refused");
    }
}
