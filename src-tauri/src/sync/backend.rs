#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum BackendError {
    Unavailable(String),
    Failed(String),
}

impl BackendError {
    pub(crate) fn message(&self) -> &str {
        match self {
            Self::Unavailable(message) | Self::Failed(message) => message,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Listed {
    pub name: String,
    pub is_dir: bool,
}

pub(crate) trait Backend: Send + Sync {
    fn check(&self) -> Result<(), BackendError>;
    fn list(&self, dir: &str) -> Result<Vec<Listed>, BackendError>;
    fn read(&self, path: &str) -> Result<Option<Vec<u8>>, BackendError>;
    fn write(&self, path: &str, bytes: &[u8]) -> Result<(), BackendError>;
    fn delete(&self, path: &str) -> Result<(), BackendError>;
}

pub(crate) fn is_safe_path(path: &str) -> bool {
    !path.is_empty() && !path.starts_with('/') && !path.contains('\\') && path.split('/').all(|part| !part.is_empty() && part != "." && part != "..")
}

pub(crate) fn is_ignored_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.starts_with('.')
        || lower.starts_with("~$")
        || [".tmp", ".partial", ".crdownload", ".icloud", ".part", ".download"].iter().any(|suffix| lower.ends_with(suffix))
        || ["conflict", "冲突", "衝突"].iter().any(|word| lower.contains(word))
        || has_copy_number(&lower)
}

fn has_copy_number(name: &str) -> bool {
    let stem = name.rsplit_once('.').map_or(name, |(stem, _)| stem);
    let Some(open) = stem.rfind(" (") else { return false };
    let inner = &stem[open + 2..];
    inner.strip_suffix(')').is_some_and(|digits| !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit()))
}
