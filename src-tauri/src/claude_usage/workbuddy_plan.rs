use std::{fs, path::{Path, PathBuf}};

use serde_json::Value;

const MAX_SNAPSHOT_BYTES: u64 = 4096;
const MAX_STALENESS_MS: i64 = 30 * 24 * 60 * 60 * 1000;

fn snapshot_path(root: &Path) -> PathBuf {
    root.join("storage").join("skeleton").join("account-snapshot.json")
}

fn read_snapshot(path: &Path) -> Option<Value> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_SNAPSHOT_BYTES {
        return None;
    }
    let value: Value = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;
    let primary = value.get("primary")?;
    primary.get("uid").and_then(Value::as_str).filter(|uid| !uid.is_empty())?;
    Some(primary.clone())
}

pub(super) fn plan_of(snapshot: &Value) -> Option<String> {
    let kind = snapshot["type"].as_str().unwrap_or_default();
    if matches!(kind, "enterprise" | "ioa") {
        return Some("enterprise".to_string());
    }
    let edition = snapshot["editionType"]
        .as_str()
        .or_else(|| snapshot["edition_type"].as_str())
        .map(str::trim)
        .filter(|edition| !edition.is_empty())
        .map(str::to_ascii_lowercase);
    let is_pro = snapshot["isPro"].as_bool().unwrap_or(false);
    match edition.as_deref() {
        Some("free" | "experience") | None if is_pro => Some("pro".to_string()),
        Some("experience") => Some("free".to_string()),
        Some(edition) => Some(edition.to_string()),
        None => None,
    }
}

pub(super) fn read_plan(roots: &[PathBuf], now: i64) -> Option<String> {
    roots
        .iter()
        .filter_map(|root| read_snapshot(&snapshot_path(root)))
        .filter_map(|snapshot| {
            let saved_at = snapshot["savedAt"].as_i64()?;
            (now.saturating_sub(saved_at) <= MAX_STALENESS_MS).then_some((saved_at, snapshot))
        })
        .max_by_key(|(saved_at, _)| *saved_at)
        .and_then(|(_, snapshot)| plan_of(&snapshot))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn maps_edition_snapshot_to_plan() {
        assert_eq!(plan_of(&json!({ "type": "personal", "editionType": "free", "isPro": false })).as_deref(), Some("free"));
        assert_eq!(plan_of(&json!({ "type": "personal", "editionType": "experience" })).as_deref(), Some("free"));
        assert_eq!(plan_of(&json!({ "type": "personal", "editionType": "free", "isPro": true })).as_deref(), Some("pro"));
        assert_eq!(plan_of(&json!({ "type": "personal", "editionType": "Pro_Trial" })).as_deref(), Some("pro_trial"));
        assert_eq!(plan_of(&json!({ "type": "enterprise", "editionType": "free" })).as_deref(), Some("enterprise"));
        assert_eq!(plan_of(&json!({ "type": "personal" })), None);
    }

    #[test]
    fn reads_newest_fresh_snapshot_and_ignores_stale_ones() {
        let dir = std::env::temp_dir().join(format!("fuyu-wb-plan-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let now = 1_795_087_763_568_i64;
        let write = |folder: &str, body: Value| {
            let path = snapshot_path(&dir.join(folder));
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, body.to_string()).unwrap();
        };
        write(".workbuddy", json!({ "primary": { "version": 1, "uid": "u1", "nickname": "n", "type": "personal", "editionType": "pro", "savedAt": now - 40 * 86_400_000_i64 } }));
        write(".workbuddy-ai", json!({ "primary": { "version": 1, "uid": "u2", "nickname": "n", "type": "personal", "editionType": "free", "isPro": false, "savedAt": now - 60_000 } }));
        let roots = [dir.join(".workbuddy"), dir.join(".workbuddy-ai"), dir.join("missing")];
        assert_eq!(read_plan(&roots, now).as_deref(), Some("free"));
        assert_eq!(read_plan(&roots[..1], now), None);
        let _ = fs::remove_dir_all(&dir);
    }
}
