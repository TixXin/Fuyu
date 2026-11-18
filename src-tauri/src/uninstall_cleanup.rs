use std::{
    ffi::OsStr,
    fs, io,
    path::{Component, Path, PathBuf},
};

const MANAGED_HOME_ITEMS: &[&str] = &[
    "todos.json",
    "settings.json",
    "settings-sync-meta.json",
    "settings-window.json",
    "tray-icon.json",
    "webview-crashes.log",
    "panic.log",
    "crash.log",
    "window-open-trace.log",
    "clipboard-open-trace.log",
    "clipboard-history.json",
    "clipboard-links.json",
    "clipboard-images",
    "clipboard-text",
    "screenshots",
    "models",
    "ssh-tunnels.json",
    "ssh",
    "cc-connect",
    "file-shelf.json",
    "media-custom-players.json",
    "calendar-sources.json",
    "pets",
    "plugins",
    "plugins.json",
    "plugins-data",
    "plugin-secrets.json",
    "dev-plugins.json",
    "plugins-v3",
    "runtime",
    "agent-approval.json",
    "local-api.json",
    "island-lab.json",
    "backups",
    "sound-packs",
    "dsh-plugin",
    "fuyu-dsh-hooks.json",
    "remote-sessions",
    "lyrics-cache",
    "wechat-gate",
    "home-migration.json",
    "rename-migration.json",
    "fuyu.lock",
    "uninstalled-hooks.json",
    "sync-config.json",
    "sync-device.json",
    "sync-state",
];

const MANAGED_HOME_PREFIXES: &[&str] = &[
    "todos-migration-backup",
    "todos.before-reimport-",
    "plugins.broken-",
    "sync-device.damaged-",
    "agent-",
    "fuyu-agent-",
    "focusd-agent-",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct CleanupOptions {
    pub(crate) delete_data: bool,
}

pub(crate) fn parse_args<I, S>(args: I) -> Option<CleanupOptions>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut run = false;
    let mut delete_data = false;
    for arg in args.into_iter().skip(1) {
        let arg = arg.as_ref();
        if arg == "--uninstall-cleanup" {
            run = true;
        } else if arg == "--delete-data" {
            delete_data = true;
        }
    }
    run.then_some(CleanupOptions { delete_data })
}

#[cfg(any(windows, test))]
pub(crate) fn is_release_credential_target(target: &str) -> bool {
    let id = crate::rename_migration::NEW_IDENTIFIER;
    if target.contains(&format!("{id}.lane-")) || target.contains(&format!("{id}.verification.")) {
        return false;
    }
    if target == id {
        return true;
    }
    if let Some(rest) = target.strip_prefix(id).and_then(|rest| rest.strip_prefix('.')) {
        return !rest.is_empty();
    }
    if let Some(before) = target.strip_suffix(id) {
        return before.ends_with('.') && before.len() > 1;
    }
    let needle = format!(".{id}.");
    if let Some(at) = target.rfind(&needle) {
        let before = &target[..at];
        let rest = &target[at + needle.len()..];
        return !before.is_empty() && !rest.is_empty();
    }
    false
}

pub(crate) fn is_safe_default_dot_fuyu(fuyu_home: &Path, profile: Option<&Path>) -> bool {
    let Some(profile) = profile else {
        return false;
    };
    if !profile.is_absolute() || profile.parent().is_none() || !fuyu_home.is_absolute() {
        return false;
    }
    if fuyu_home
        .components()
        .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return false;
    }
    if fuyu_home == profile
        || fuyu_home.parent() != Some(profile)
        || fuyu_home.file_name().and_then(|name| name.to_str()) != Some(".fuyu")
        || fuyu_home != profile.join(".fuyu")
    {
        return false;
    }
    match fs::symlink_metadata(fuyu_home) {
        Ok(meta) => !meta.file_type().is_symlink() && meta.file_type().is_dir(),
        Err(error) => error.kind() == io::ErrorKind::NotFound,
    }
}

pub(crate) fn is_managed_home_entry(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    MANAGED_HOME_ITEMS.contains(&lower.as_str())
        || MANAGED_HOME_PREFIXES
            .iter()
            .any(|prefix| lower.starts_with(prefix))
}

pub(crate) fn cleanup_fuyu_home(fuyu_home: &Path, profile: Option<&Path>) {
    if !fuyu_home.is_absolute() || fuyu_home.parent().is_none() {
        return;
    }
    if is_safe_default_dot_fuyu(fuyu_home, profile) {
        let _ = fs::remove_dir_all(fuyu_home);
        return;
    }
    let Ok(entries) = fs::read_dir(fuyu_home) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        if !is_managed_home_entry(&name.to_string_lossy()) {
            continue;
        }
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            if fs::remove_file(&path).is_err() {
                let _ = fs::remove_dir(&path);
            }
        } else if file_type.is_dir() {
            let _ = fs::remove_dir_all(&path);
        } else {
            let _ = fs::remove_file(&path);
        }
    }
    if profile.is_none_or(|dir| dir != fuyu_home) {
        let _ = fs::remove_dir(fuyu_home);
    }
}

pub(crate) fn run_cleanup_in(
    fuyu_home: &Path,
    profile: Option<&Path>,
    delete_data: bool,
    clean_credentials: impl FnOnce(&Path),
) {
    if let Some(profile) = profile {
        crate::agent_status::cleanup_for_app_uninstall(fuyu_home, profile, delete_data);
    }
    if delete_data {
        clean_credentials(fuyu_home);
        cleanup_fuyu_home(fuyu_home, profile);
    }
}

#[cfg(windows)]
fn delete_release_credentials(_fuyu_home: &Path) {
    let _ = crate::win32::credentials::delete_generic_credentials(is_release_credential_target);
}

#[cfg(not(windows))]
fn delete_release_credentials(fuyu_home: &Path) {
    use serde_json::Value;

    let mut pairs = vec![
        ("com.tixxin.fuyu.bark".to_string(), "device-key".to_string()),
        ("com.tixxin.fuyu.plan-usage".to_string(), "glm".to_string()),
        ("com.tixxin.fuyu.plan-usage".to_string(), "kimi".to_string()),
        ("com.tixxin.fuyu.sync".to_string(), "webdav-password".to_string()),
    ];
    for account in [
        "custom-address",
        "deepseek",
        "volcengine",
        "dashscope",
        "moonshot",
        "siliconflow",
        "openai",
        "custom",
    ] {
        pairs.push(("com.tixxin.fuyu.translation".to_string(), account.to_string()));
    }
    if let Ok(text) = fs::read_to_string(fuyu_home.join("calendar-sources.json")) {
        if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(&text) {
            for id in items
                .iter()
                .filter_map(|item| item.get("id").and_then(Value::as_str))
            {
                pairs.push(("com.tixxin.fuyu.calendar".to_string(), id.to_string()));
            }
        }
    }
    if let Ok(text) = fs::read_to_string(fuyu_home.join("plugin-secrets.json")) {
        if let Ok(Value::Object(plugins)) = serde_json::from_str::<Value>(&text) {
            for (plugin_id, keys) in plugins {
                for key in keys.as_array().into_iter().flatten().filter_map(Value::as_str) {
                    pairs.push((
                        format!("com.tixxin.fuyu.plugin.{plugin_id}"),
                        key.to_string(),
                    ));
                }
            }
        }
    }
    if let Ok(text) = fs::read_to_string(fuyu_home.join("settings.json")) {
        if let Some(raw_mail) = serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}'))
            .ok()
            .and_then(|file| {
                file.get("keys")?
                    .get("fuyu-qq-mail-settings")?
                    .as_str()
                    .map(str::to_owned)
            })
        {
            if let Ok(mail) = serde_json::from_str::<Value>(&raw_mail) {
                if let Some(email) = mail.get("email").and_then(Value::as_str) {
                    pairs.push(("com.tixxin.fuyu.qq-mail".to_string(), email.to_string()));
                }
                for email in mail
                    .get("accounts")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|account| account.get("email").and_then(Value::as_str))
                {
                    pairs.push(("com.tixxin.fuyu.qq-mail".to_string(), email.to_string()));
                }
            }
        }
    }
    for (service, user) in pairs {
        if let Ok(entry) = keyring::Entry::new(&service, &user) {
            let _ = entry.delete_credential();
        }
    }
}

fn fallback_app_data(profile: Option<&Path>) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        profile.map(|dir| {
            dir.join("AppData")
                .join("Roaming")
                .join(crate::rename_migration::NEW_IDENTIFIER)
        })
    }
    #[cfg(not(windows))]
    {
        let _ = profile;
        None
    }
}

pub(crate) fn maybe_run_from_args() -> bool {
    let Some(options) = parse_args(std::env::args_os()) else {
        return false;
    };
    let profile = crate::system::windows_home_dir().ok();
    let app_data = crate::home_dir::app_data_dir(crate::rename_migration::NEW_IDENTIFIER)
        .or_else(|| fallback_app_data(profile.as_deref()));
    let env_home = std::env::var(crate::home_dir::ENV).ok();
    let fuyu_home = match app_data {
        Some(app_data) => {
            let pointer = fs::read_to_string(app_data.join(crate::home_dir::POINTER_FILE)).ok();
            crate::home_dir::resolve(
                env_home.as_deref(),
                pointer.as_deref(),
                profile.as_deref(),
                &app_data,
            )
            .0
        }
        None => match env_home
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .filter(|path| path.is_absolute())
            .or_else(|| profile.as_ref().map(|dir| dir.join(".fuyu")))
        {
            Some(home) => home,
            None => return true,
        },
    };
    run_cleanup_in(
        &fuyu_home,
        profile.as_deref(),
        options.delete_data,
        delete_release_credentials,
    );
    true
}

#[cfg(test)]
mod tests {
    use super::{
        cleanup_fuyu_home, is_release_credential_target, is_safe_default_dot_fuyu, parse_args,
        run_cleanup_in, CleanupOptions,
    };
    use std::{
        cell::Cell,
        fs,
        path::{Path, PathBuf},
    };

    fn temp_root(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "fuyu-uninstall-cleanup-{label}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn parses_exact_uninstall_cleanup_arguments() {
        assert_eq!(parse_args(["fuyu.exe"]), None);
        assert_eq!(parse_args(["fuyu.exe", "--delete-data"]), None);
        assert_eq!(parse_args(["fuyu.exe", "--uninstall-cleanup=1"]), None);
        assert_eq!(parse_args(["--uninstall-cleanup"]), None);
        assert_eq!(
            parse_args(["fuyu.exe", "--uninstall-cleanup"]),
            Some(CleanupOptions { delete_data: false })
        );
        assert_eq!(
            parse_args(["fuyu.exe", "--uninstall-cleanup", "--delete-data"]),
            Some(CleanupOptions { delete_data: true })
        );
    }

    #[test]
    fn matches_release_credentials_and_excludes_lanes_verification_and_others() {
        for matched in [
            "com.tixxin.fuyu",
            "com.tixxin.fuyu.bark",
            "x.com.tixxin.fuyu",
            "device-key.com.tixxin.fuyu.bark",
            "deepl.com.tixxin.fuyu.translation",
            "me@qq.com.com.tixxin.fuyu.qq-mail",
            "token.com.tixxin.fuyu.plugin.dev.focusd.github-issues",
        ] {
            assert!(is_release_credential_target(matched), "{matched}");
        }
        for excluded in [
            "device-key.com.tixxin.fuyu.lane-1.bark",
            "device-key.com.tixxin.fuyu.lane-20.bark",
            "com.tixxin.fuyu.lane-1",
            "x.com.tixxin.fuyu.verification.abc.bark",
            "com.tixxin.fuyu.verification.run1",
            "x.com.tixxin.fuyu.",
            "com.tixxin.fuyu.",
            ".com.tixxin.fuyu",
            ".com.tixxin.fuyu.bark",
            "x.com.tixxin.fuyuu.bark",
            "x.com.focusd.island.bark",
            "git:https://github.com",
        ] {
            assert!(!is_release_credential_target(excluded), "{excluded}");
        }
    }

    #[test]
    fn gatekeeper_accepts_only_real_profile_dot_fuyu_directory() {
        let root = temp_root("gate");
        let profile = root.join("user");
        let dot_fuyu = profile.join(".fuyu");
        let custom = root.join("OneDrive").join("Sync");
        fs::create_dir_all(&dot_fuyu).unwrap();
        fs::create_dir_all(&custom).unwrap();

        assert!(is_safe_default_dot_fuyu(&dot_fuyu, Some(&profile)));
        assert!(!is_safe_default_dot_fuyu(&dot_fuyu, None));
        assert!(!is_safe_default_dot_fuyu(&profile, Some(&profile)));
        assert!(!is_safe_default_dot_fuyu(&custom, Some(&profile)));
        assert!(!is_safe_default_dot_fuyu(
            &profile.join("sub").join("..").join(".fuyu"),
            Some(&profile)
        ));
        assert!(!is_safe_default_dot_fuyu(Path::new(".fuyu"), Some(&profile)));

        #[cfg(unix)]
        {
            let link_profile = root.join("linked-user");
            fs::create_dir_all(&link_profile).unwrap();
            let linked_dot_fuyu = link_profile.join(".fuyu");
            std::os::unix::fs::symlink(&custom, &linked_dot_fuyu).unwrap();
            assert!(!is_safe_default_dot_fuyu(&linked_dot_fuyu, Some(&link_profile)));
        }
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn keep_data_uninstall_removes_hooks_and_records_marker_while_delete_data_cleans_dirs() {
        let root = temp_root("flow");
        let profile = root.join("profile");
        let dot_fuyu = profile.join(".fuyu");
        fs::create_dir_all(profile.join(".claude")).unwrap();
        fs::create_dir_all(dot_fuyu.join("screenshots")).unwrap();
        fs::write(
            profile.join(".claude").join("CLAUDE.md"),
            "user rules\n<!-- fuyu: reply marker v5 -->\nmarker\n<!-- /fuyu: reply marker -->\n",
        )
        .unwrap();
        fs::write(dot_fuyu.join("todos.json"), "{}").unwrap();
        let creds_called = Cell::new(false);

        run_cleanup_in(&dot_fuyu, Some(&profile), false, |_| creds_called.set(true));
        assert!(!creds_called.get());
        assert!(dot_fuyu.join("todos.json").exists());
        assert!(dot_fuyu.join("uninstalled-hooks.json").is_file());
        assert!(!fs::read_to_string(profile.join(".claude").join("CLAUDE.md"))
            .unwrap()
            .contains("fuyu: reply marker"));

        run_cleanup_in(&dot_fuyu, Some(&profile), true, |_| creds_called.set(true));
        assert!(creds_called.get());
        assert!(!dot_fuyu.exists());

        let shared = root.join("SyncFolder");
        fs::create_dir_all(shared.join("plugins-v3").join("data")).unwrap();
        fs::create_dir_all(shared.join("agent-sessions")).unwrap();
        fs::write(shared.join("todos.json"), "{}").unwrap();
        fs::write(shared.join("todos-migration-backup-1.json"), "{}").unwrap();
        fs::write(shared.join("fuyu-agent-running.cmd"), "@echo off").unwrap();
        fs::write(shared.join("notes.md"), "keep me").unwrap();
        fs::write(shared.join("photo.jpg"), "binary").unwrap();
        cleanup_fuyu_home(&shared, Some(&profile));
        assert!(shared.is_dir());
        assert_eq!(fs::read_to_string(shared.join("notes.md")).unwrap(), "keep me");
        assert_eq!(fs::read_to_string(shared.join("photo.jpg")).unwrap(), "binary");
        for removed in ["todos.json", "todos-migration-backup-1.json", "fuyu-agent-running.cmd", "plugins-v3", "agent-sessions"] {
            assert!(!shared.join(removed).exists(), "{removed}");
        }
        let dedicated = root.join("DedicatedFuyu");
        fs::create_dir_all(&dedicated).unwrap();
        fs::write(dedicated.join("settings.json"), "{}").unwrap();
        cleanup_fuyu_home(&dedicated, Some(&profile));
        assert!(!dedicated.exists());
        let _ = fs::remove_dir_all(&root);
    }
}
