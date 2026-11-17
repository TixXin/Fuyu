use std::{future::Future, time::Duration};

use crate::user_error::UserError;

pub(crate) const MIRROR_PREFIXES: [&str; 2] = ["https://ghfast.top/", "https://gh-proxy.com/"];
pub(crate) const DIRECT: &str = "GitHub";
const GITHUB_HOSTS: [&str; 5] = [
    "github.com",
    "raw.githubusercontent.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
    "codeload.github.com",
];
pub(crate) const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
pub(crate) const READ_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Source {
    pub name: &'static str,
    pub url: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum FailureKind {
    Unreachable,
    Timeout,
    Status,
    TooLarge,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Failure {
    pub kind: FailureKind,
    pub message: String,
}

impl Failure {
    pub(crate) fn new(kind: FailureKind, message: impl Into<String>) -> Self {
        Self { kind, message: message.into() }
    }

    pub(crate) fn from_reqwest(error: &reqwest::Error) -> Self {
        let kind = if error.is_timeout() {
            FailureKind::Timeout
        } else if error.status().is_some() {
            FailureKind::Status
        } else {
            FailureKind::Unreachable
        };
        Self::new(kind, error.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Exhausted {
    pub attempts: Vec<(&'static str, Failure)>,
}

impl Exhausted {
    pub(crate) fn kind(&self) -> FailureKind {
        self.attempts.iter().map(|(_, failure)| failure.kind).max().unwrap_or(FailureKind::Unreachable)
    }

    pub(crate) fn tried(&self) -> String {
        self.attempts.iter().map(|(name, _)| *name).collect::<Vec<_>>().join(", ")
    }

    pub(crate) fn summary(&self) -> String {
        self.attempts
            .iter()
            .map(|(name, failure)| format!("{name}: {}", failure.message))
            .collect::<Vec<_>>()
            .join("; ")
    }

    pub(crate) fn to_user_error(&self, what: &str) -> UserError {
        let error = match self.kind() {
            FailureKind::Unreachable => UserError::new("download.unreachable", format!("Could not reach any download source for {what}.")),
            FailureKind::Timeout => UserError::new("download.timeout", format!("Downloading {what} timed out on every source.")),
            FailureKind::Invalid => UserError::new("download.checksum", format!("The downloaded {what} did not pass verification.")),
            FailureKind::Status | FailureKind::TooLarge => UserError::new("download.failed", format!("Downloading {what} failed on every source.")),
        };
        error.arg("what", what).arg("tried", self.tried()).detail(self.summary())
    }
}

fn is_github(url: &str) -> bool {
    reqwest::Url::parse(url)
        .ok()
        .filter(|parsed| parsed.scheme() == "https")
        .and_then(|parsed| parsed.host_str().map(str::to_ascii_lowercase))
        .is_some_and(|host| GITHUB_HOSTS.contains(&host.as_str()))
}

fn mirror_name(prefix: &str) -> &str {
    prefix.trim_start_matches("https://").trim_end_matches('/')
}

pub(crate) fn sources(url: &str) -> Vec<Source> {
    let mut list = vec![Source { name: DIRECT, url: url.to_string() }];
    if is_github(url) {
        list.extend(MIRROR_PREFIXES.iter().map(|prefix| Source { name: mirror_name(prefix), url: format!("{prefix}{url}") }));
    }
    list
}

pub(crate) async fn first_success<T, F, Fut>(url: &str, mut attempt: F) -> Result<(T, &'static str), Exhausted>
where
    F: FnMut(Source) -> Fut,
    Fut: Future<Output = Result<T, Failure>>,
{
    let mut attempts = Vec::new();
    for source in sources(url) {
        let name = source.name;
        match attempt(source).await {
            Ok(value) => return Ok((value, name)),
            Err(failure) => attempts.push((name, failure)),
        }
    }
    Err(Exhausted { attempts })
}

pub(crate) fn client(user_agent: &str, total: Duration) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(READ_TIMEOUT)
        .timeout(total)
        .user_agent(user_agent);
    if let Some(proxy) = super::updater::reqwest_proxy().map_err(|error| error.to_string())? {
        builder = builder.proxy(proxy);
    }
    builder.build().map_err(|error| format!("Could not create the HTTP client: {error}"))
}

pub(crate) async fn fetch(client: &reqwest::Client, url: &str, limit: u64) -> Result<Option<Vec<u8>>, Failure> {
    let response = client.get(url).send().await.map_err(|error| Failure::from_reqwest(&error))?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(Failure::new(FailureKind::Status, format!("answered {}", response.status())));
    }
    if response.content_length().is_some_and(|length| length > limit) {
        return Err(Failure::new(FailureKind::TooLarge, format!("larger than {limit} bytes")));
    }
    let bytes = response.bytes().await.map_err(|error| Failure::from_reqwest(&error))?;
    if bytes.len() as u64 > limit {
        return Err(Failure::new(FailureKind::TooLarge, format!("larger than {limit} bytes")));
    }
    Ok(Some(bytes.to_vec()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn github_urls_get_the_two_mirrors_after_the_direct_source() {
        let url = "https://github.com/o/r/releases/download/v1/a.plugin";
        let list = sources(url);
        let names: Vec<_> = list.iter().map(|source| source.name).collect();
        assert_eq!(names, ["GitHub", "ghfast.top", "gh-proxy.com"]);
        assert_eq!(list[1].url, format!("https://ghfast.top/{url}"));
        assert_eq!(list[2].url, format!("https://gh-proxy.com/{url}"));
        assert_eq!(sources("https://raw.githubusercontent.com/o/r/main/index.json").len(), 3);
    }

    #[test]
    fn other_hosts_only_use_the_direct_source() {
        assert_eq!(sources("https://example.com/github.com/a").len(), 1);
        assert_eq!(sources("http://github.com/o/r").len(), 1);
        assert_eq!(sources("https://api.github.com/repos/o/r").len(), 1);
    }

    #[test]
    fn the_prefixes_match_the_shipped_manifest_endpoints() {
        let config: serde_json::Value = serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
        let endpoints: Vec<String> = config["plugins"]["updater"]["endpoints"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|value| value.as_str().map(str::to_string))
            .collect();
        let direct = &endpoints[0];
        let expected: Vec<String> = sources(direct).into_iter().map(|source| source.url).collect();
        assert_eq!(endpoints, expected);
    }

    #[test]
    fn the_first_working_source_wins_and_failures_are_kept() {
        let url = "https://github.com/o/r/a";
        let result = tauri::async_runtime::block_on(first_success(url, |source| async move {
            if source.name == "gh-proxy.com" {
                Ok(source.url)
            } else if source.name == DIRECT {
                Err(Failure::new(FailureKind::Timeout, "timed out"))
            } else {
                Err(Failure::new(FailureKind::Unreachable, "refused"))
            }
        }));
        assert_eq!(result, Ok((format!("https://gh-proxy.com/{url}"), "gh-proxy.com")));
    }

    #[test]
    fn exhaustion_reports_the_most_telling_failure() {
        let failed = tauri::async_runtime::block_on(first_success::<(), _, _>("https://github.com/o/r/a", |source| async move {
            let kind = if source.name == "ghfast.top" { FailureKind::Invalid } else { FailureKind::Timeout };
            Err(Failure::new(kind, "x"))
        }))
        .unwrap_err();
        assert_eq!(failed.kind(), FailureKind::Invalid);
        assert_eq!(failed.tried(), "GitHub, ghfast.top, gh-proxy.com");
        assert_eq!(failed.to_user_error("InfLink-rs").code(), "download.checksum");
        let unreachable = Exhausted { attempts: vec![(DIRECT, Failure::new(FailureKind::Unreachable, "dns"))] };
        assert_eq!(unreachable.to_user_error("x").code(), "download.unreachable");
    }
}
