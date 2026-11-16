use std::{
    fs, io,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};

use serde_json::{json, Value};

use crate::rename_migration::data_dirs::copy_tree;

const LEFT_OUT: [&str; 14] = [
    "fuyu.lock",
    "home.json",
    "home-migration.json",
    "rename-migration.json",
    "dev-copy.json",
    "local-api.json",
    "island-lab.json",
    "ssh-tunnels.json",
    "ssh",
    "remote-sessions",
    "wechat-gate",
    "clipboard-history.json",
    "clipboard-images",
    "screenshots",
];
const LEFT_OUT_PREFIXES: [&str; 3] = ["agent-", "fuyu-agent-", "focusd-agent-"];
const LEFT_OUT_SUFFIXES: [&str; 4] = [".tmp", ".migrating", ".copying", "cache"];
const SWITCHED_OFF: [&str; 4] = [
    "fuyu-qq-notifications-enabled",
    "fuyu-wechat-reminders-enabled",
    "fuyu-wechat-expose-ui",
    "fuyu-wechat-hide-taskbar-button",
];
const MAIL_KEY: &str = "fuyu-qq-mail-settings";
const PUSH_KEY: &str = "fuyu-agent-push";
const RENAME_TRIES: u32 = 10;
const RENAME_PAUSE: Duration = Duration::from_millis(200);

pub(super) fn carried(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    !(LEFT_OUT.contains(&name.as_str())
        || crate::sync::LOCAL_FILES.contains(&name.as_str())
        || LEFT_OUT_PREFIXES.iter().any(|prefix| name.starts_with(prefix))
        || LEFT_OUT_SUFFIXES.iter().any(|suffix| name.ends_with(suffix)))
}

fn quiet_mail(text: &str) -> Option<String> {
    let mut mail: Value = serde_json::from_str(text).ok()?;
    match mail.get_mut("accounts").and_then(Value::as_array_mut) {
        Some(accounts) => {
            for account in accounts.iter_mut().filter_map(Value::as_object_mut) {
                account.insert("enabled".into(), Value::Bool(false));
            }
        }
        None => {
            mail.as_object_mut()?.insert("enabled".into(), Value::Bool(false));
        }
    }
    Some(mail.to_string())
}

pub(super) fn quiet_settings(text: Option<&str>) -> String {
    let mut file = text
        .and_then(|text| serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}')).ok())
        .filter(|file| file.get("keys").is_some_and(Value::is_object))
        .unwrap_or_else(|| json!({ "app": "fuyu", "version": 1, "exportedAt": "1970-01-01T00:00:00.000Z", "keys": {} }));
    if let Some(keys) = file.get_mut("keys").and_then(Value::as_object_mut) {
        for key in SWITCHED_OFF {
            keys.insert(key.into(), Value::String("false".into()));
        }
        keys.remove(PUSH_KEY);
        match keys.get(MAIL_KEY).and_then(Value::as_str).map(quiet_mail) {
            Some(Some(mail)) => {
                keys.insert(MAIL_KEY.into(), Value::String(mail));
            }
            Some(None) => {
                keys.remove(MAIL_KEY);
            }
            None => {}
        }
    }
    serde_json::to_string_pretty(&file).unwrap_or_default()
}

fn beside(dir: &Path, suffix: &str) -> PathBuf {
    let mut name = dir.file_name().map(|name| name.to_os_string()).unwrap_or_default();
    name.push(suffix);
    dir.with_file_name(name)
}

fn remove_if_present(dir: &Path) -> io::Result<()> {
    match fs::remove_dir_all(dir) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

fn set_aside(dir: &Path, stamp: u64) -> io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    let kept = beside(dir, &format!(".before-copy-{stamp}"));
    let mut tries = 0;
    loop {
        match fs::rename(dir, &kept) {
            Ok(()) => return Ok(()),
            Err(error) if tries + 1 >= RENAME_TRIES => return Err(error),
            Err(_) => {
                tries += 1;
                thread::sleep(RENAME_PAUSE);
            }
        }
    }
}

pub(super) fn copy(real: &Path, dev: &Path, webview: Option<&Path>, stamp: u64) -> io::Result<()> {
    let staged = beside(dev, ".copying");
    let result = (|| {
        remove_if_present(&staged)?;
        fs::create_dir_all(&staged)?;
        for entry in fs::read_dir(real)? {
            let entry = entry?;
            let name = entry.file_name();
            if !carried(&name.to_string_lossy()) {
                continue;
            }
            let kind = entry.file_type()?;
            if kind.is_dir() {
                copy_tree(&entry.path(), &staged.join(&name))?;
            } else if kind.is_file() {
                fs::copy(entry.path(), staged.join(&name))?;
            }
        }
        let settings = staged.join(crate::settings_file::FILE_NAME);
        fs::write(&settings, quiet_settings(fs::read_to_string(&settings).ok().as_deref()))?;
        set_aside(dev, stamp)?;
        fs::rename(&staged, dev)
    })();
    if result.is_err() {
        let _ = remove_if_present(&staged);
        return result;
    }
    if let Some(webview) = webview {
        if let Err(error) = set_aside(webview, stamp) {
            eprintln!("could not set the development build's old WebView data aside ({}): {error}", webview.display());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{carried, copy, quiet_settings};
    use serde_json::Value;
    use std::fs;

    #[test]
    fn what_belongs_to_the_installed_app_alone_stays_behind() {
        for name in [
            "fuyu.lock", "home.json", "home-migration.json", "rename-migration.json", "dev-copy.json", "local-api.json", "island-lab.json",
            "agent-approval.json", "agent-status.json", "agent-claudeCode-running.flag", "agent-claudeCode-notification.json", "agent-focus.log",
            "agent-remote-hosts.json", "agent-sessions-seen.json", "agent-notifications", "agent-sessions", "agent-terminals",
            "fuyu-agent-status.ps1", "fuyu-agent-running.cmd", "focusd-agent-status.ps1", "ssh-tunnels.json", "ssh", "remote-sessions", "wechat-gate",
            "clipboard-history.json", "clipboard-images", "screenshots", "lyrics-cache", "todos.json.tmp", "x.migrating", "Fuyu.Lock",
            "sync-device.json", "sync-config.json", "sync-state",
        ] {
            assert!(!carried(name), "{name}");
        }
        for name in [
            "todos.json", "settings.json", "settings-window.json", "plugins", "plugins-data", "plugins.json", "dev-plugins.json", "sound-packs", "todo",
            "calendar-sources.json", "file-shelf.json", "todos-migration-backup.json", "todos.before-reimport-1794320134552.json",
            "settings-sync-meta.json",
        ] {
            assert!(carried(name), "{name}");
        }
    }

    fn keys(text: &str) -> serde_json::Map<String, Value> {
        let file: Value = serde_json::from_str(text).unwrap();
        assert_eq!(file["app"], "fuyu");
        assert_eq!(file["version"], 1);
        file["keys"].as_object().unwrap().clone()
    }

    #[test]
    fn the_copied_settings_do_not_notify_or_push_a_second_time() {
        let text = r#"{ "app": "fuyu", "version": 1, "exportedAt": "x", "keys": {
            "fuyu-locale": "en", "fuyu-qq-notifications-enabled": "true", "fuyu-wechat-expose-ui": "true", "fuyu-agent-push": "{\"enabled\":true}",
            "fuyu-qq-mail-settings": "{\"accounts\":[{\"email\":\"a@qq.com\",\"host\":\"\",\"enabled\":true},{\"email\":\"b@163.com\",\"host\":\"imap.163.com\",\"enabled\":false}]}"
        } }"#;
        let quiet = keys(&quiet_settings(Some(text)));
        assert_eq!(quiet["fuyu-locale"], "en");
        for key in ["fuyu-qq-notifications-enabled", "fuyu-wechat-reminders-enabled", "fuyu-wechat-expose-ui", "fuyu-wechat-hide-taskbar-button"] {
            assert_eq!(quiet[key], "false", "{key}");
        }
        assert!(!quiet.contains_key("fuyu-agent-push"));
        let mail: Value = serde_json::from_str(quiet["fuyu-qq-mail-settings"].as_str().unwrap()).unwrap();
        assert_eq!(mail["accounts"][0]["email"], "a@qq.com");
        assert_eq!(mail["accounts"][1]["host"], "imap.163.com");
        assert!(mail["accounts"].as_array().unwrap().iter().all(|account| account["enabled"] == false));
        assert!(quiet.values().all(Value::is_string));
    }

    #[test]
    fn old_single_mailboxes_and_missing_or_broken_files_end_up_quiet_too() {
        let single = r#"{ "app": "fuyu", "version": 1, "keys": { "fuyu-qq-mail-settings": "{\"email\":\"a@qq.com\",\"enabled\":true}" } }"#;
        let mail: Value = serde_json::from_str(keys(&quiet_settings(Some(single)))["fuyu-qq-mail-settings"].as_str().unwrap()).unwrap();
        assert_eq!((mail["email"].as_str(), mail["enabled"].as_bool()), (Some("a@qq.com"), Some(false)));
        let broken = r#"{ "app": "fuyu", "version": 1, "keys": { "fuyu-qq-mail-settings": "not json" } }"#;
        assert!(!keys(&quiet_settings(Some(broken))).contains_key("fuyu-qq-mail-settings"));
        for text in [None, Some("not json"), Some("\u{feff}{}")] {
            let quiet = keys(&quiet_settings(text));
            assert_eq!(quiet["fuyu-qq-notifications-enabled"], "false");
            assert_eq!(quiet.len(), 4);
        }
    }

    #[test]
    fn the_copy_replaces_old_development_data_and_keeps_it_beside() {
        let root = std::env::temp_dir().join(format!("fuyu-dev-copy-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let (real, dev, webview) = (root.join(".fuyu"), root.join("roaming").join("lane-1"), root.join("local").join("lane-1"));
        for dir in [real.join("plugins").join("a"), real.join("screenshots"), real.join("agent-sessions"), dev.clone(), webview.join("EBWebView")] {
            fs::create_dir_all(dir).unwrap();
        }
        fs::write(real.join("todos.json"), "real").unwrap();
        fs::write(real.join("plugins").join("a").join("x.txt"), "x").unwrap();
        fs::write(real.join("screenshots").join("shot.png"), "png").unwrap();
        fs::write(real.join("agent-status.json"), "{}").unwrap();
        fs::write(real.join("home-migration.json"), r#"{"hooks":false}"#).unwrap();
        fs::write(real.join("settings.json"), r#"{ "app": "fuyu", "version": 1, "keys": { "fuyu-locale": "en" } }"#).unwrap();
        fs::write(dev.join("todos.json"), "old").unwrap();

        copy(&real, &dev, Some(&webview), 42).unwrap();

        assert_eq!(fs::read_to_string(dev.join("todos.json")).unwrap(), "real");
        assert!(dev.join("plugins").join("a").join("x.txt").exists());
        for left in ["screenshots", "agent-sessions", "agent-status.json", "home-migration.json"] {
            assert!(!dev.join(left).exists(), "{left}");
        }
        let quiet = keys(&fs::read_to_string(dev.join("settings.json")).unwrap());
        assert_eq!((quiet["fuyu-locale"].as_str(), quiet["fuyu-wechat-reminders-enabled"].as_str()), (Some("en"), Some("false")));
        assert_eq!(fs::read_to_string(root.join("roaming").join("lane-1.before-copy-42").join("todos.json")).unwrap(), "old");
        assert!(root.join("local").join("lane-1.before-copy-42").join("EBWebView").exists() && !webview.exists());
        assert!(!root.join("roaming").join("lane-1.copying").exists());
        assert_eq!(fs::read_to_string(real.join("todos.json")).unwrap(), "real");
        assert!(real.join("screenshots").join("shot.png").exists() && real.join("home-migration.json").exists());

        let fresh = root.join("roaming").join("lane-2");
        copy(&real, &fresh, None, 43).unwrap();
        assert_eq!(fs::read_to_string(fresh.join("todos.json")).unwrap(), "real");
        let _ = fs::remove_dir_all(&root);
    }
}
