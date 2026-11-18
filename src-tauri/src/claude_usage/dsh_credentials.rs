use std::{fs, io::Read, path::Path};

use sha2::{Digest, Sha256};

const MAX_CREDENTIAL_BYTES: u64 = 64 * 1024;
const OFFICIAL_BASE_URL: &str = "https://api.deepseek.com";
const OFFICIAL_PLATFORM_ORIGIN: &str = "https://platform.deepseek.com";
const OFFICIAL_API_KEY_ENV: &str = "DEEPSEEK_API_KEY";

pub(super) enum DshCredential {
    ApiKey(String),
    AccountToken(String),
}

impl DshCredential {
    pub(super) fn hash(&self) -> [u8; 32] {
        let mut hasher = Sha256::new();
        match self {
            Self::ApiKey(secret) => {
                hasher.update(b"api:");
                hasher.update(secret.as_bytes());
            }
            Self::AccountToken(secret) => {
                hasher.update(b"account:");
                hasher.update(secret.as_bytes());
            }
        }
        hasher.finalize().into()
    }
}

fn unquote_scalar(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    let value = if trimmed.starts_with('"') {
        serde_json::from_str::<String>(trimmed).ok()?
    } else if let Some(inner) = trimmed.strip_prefix('\'') {
        inner.strip_suffix('\'')?.replace("''", "'")
    } else {
        if trimmed.starts_with(['&', '*', '!', '|', '>', '{', '[']) {
            return None;
        }
        trimmed.split(" #").next()?.trim().to_string()
    };
    (!value.is_empty() && !value.chars().any(char::is_control)).then_some(value)
}

pub(super) fn parse_credentials_yaml(text: &str, route: &str) -> Option<DshCredential> {
    let mut path_stack: Vec<(usize, String)> = Vec::new();
    let mut version_ok = false;
    let mut api_key: Option<String> = None;
    let mut grant_kind = false;
    let mut grant_version = false;
    let mut grant_issuer: Option<String> = None;
    let mut grant_token: Option<String> = None;

    for line in text.trim_start_matches('\u{feff}').lines() {
        let trimmed_start = line.trim_start();
        if trimmed_start.is_empty() || trimmed_start.starts_with('#') {
            continue;
        }
        if line.contains('\t') {
            return None;
        }
        let indent = line.len() - trimmed_start.len();
        while path_stack.last().is_some_and(|(depth, _)| *depth >= indent) {
            path_stack.pop();
        }
        let Some((raw_key, raw_val)) = trimmed_start.split_once(':') else {
            continue;
        };
        let Some(key) = unquote_scalar(raw_key) else {
            path_stack.push((indent, "\0".to_string()));
            continue;
        };
        if raw_val.trim().is_empty() {
            path_stack.push((indent, key));
            continue;
        }
        let parents: Vec<&str> = path_stack.iter().map(|(_, name)| name.as_str()).collect();
        match (parents.as_slice(), key.as_str()) {
            ([], "version") => version_ok = raw_val.trim() == "1",
            (["refs"], "DEEPSEEK_API_KEY") if route == "deepseek-official" => {
                api_key = unquote_scalar(raw_val);
            }
            (["records", "deepseek-account-platform/default"], "kind") if route == "deepseek-account" => {
                grant_kind = unquote_scalar(raw_val).as_deref() == Some("grant");
            }
            (["records", "deepseek-account-platform/default", "payload"], field) if route == "deepseek-account" => {
                if let Some(val) = unquote_scalar(raw_val) {
                    match field {
                        "version" => grant_version = val == "1",
                        "issuer" => grant_issuer = Some(val),
                        "token" => grant_token = Some(val),
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }

    if !version_ok {
        return None;
    }
    let valid_ascii = |secret: &str| !secret.is_empty() && secret.bytes().all(|b| (0x21..=0x7e).contains(&b));
    match route {
        "deepseek-official" => api_key.filter(|k| valid_ascii(k)).map(DshCredential::ApiKey),
        "deepseek-account"
            if grant_kind
                && grant_version
                && grant_issuer.as_deref() == Some(OFFICIAL_PLATFORM_ORIGIN) =>
        {
            grant_token.filter(|t| valid_ascii(t)).map(DshCredential::AccountToken)
        }
        _ => None,
    }
}

pub(super) fn read_credential(root: &Path, route: &str) -> Option<DshCredential> {
    let text = read_small_text(&root.join(".credentials.yaml"))?;
    parse_credentials_yaml(&text, route)
}

fn read_small_text(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    if file.metadata().ok()?.len() > MAX_CREDENTIAL_BYTES {
        return None;
    }
    let mut text = String::new();
    file.take(MAX_CREDENTIAL_BYTES + 1).read_to_string(&mut text).ok()?;
    (text.len() as u64 <= MAX_CREDENTIAL_BYTES).then_some(text)
}

pub(super) fn route_is_official(root: &Path) -> bool {
    let mut candidates = vec![root.join("cordis.yml"), root.join("cordis.patch.yml")];
    for entry in fs::read_dir(root.join("profiles")).into_iter().flatten().flatten() {
        let dir = entry.path();
        candidates.push(dir.join("cordis.yml"));
        candidates.push(dir.join("cordis.patch.yml"));
    }
    for path in candidates {
        if let Some(text) = read_small_text(&path) {
            if !config_uses_default_endpoints(&text) {
                return false;
            }
        }
    }
    true
}

pub(super) fn config_uses_default_endpoints(text: &str) -> bool {
    for raw_line in text.lines() {
        let line = raw_line.split('#').next().unwrap_or_default().trim();
        if line.is_empty() {
            continue;
        }
        for key in ["baseURL", "apiKeyEnv", "platformOrigin"] {
            for segment in line.split([',', '{', '}']) {
                let seg = segment.trim();
                let Some(rest) = seg.strip_prefix(key).and_then(|s| s.trim_start().strip_prefix(':')) else {
                    continue;
                };
                let Some(val) = unquote_scalar(rest) else {
                    return false;
                };
                let trimmed = val.trim_end_matches('/');
                let ok = match key {
                    "baseURL" => trimmed == OFFICIAL_BASE_URL,
                    "platformOrigin" => trimmed == OFFICIAL_PLATFORM_ORIGIN,
                    "apiKeyEnv" => val == OFFICIAL_API_KEY_ENV,
                    _ => true,
                };
                if !ok {
                    return false;
                }
            }
        }
    }
    true
}
