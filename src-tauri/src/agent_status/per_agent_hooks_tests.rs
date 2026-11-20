use std::{fs, path::PathBuf};

use super::*;
use crate::agent_status::hooks_state::HookInstallState;

fn temp_root(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-per-agent-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn state_of(app_dir: &Path, home: &Path, provider: &str) -> HookInstallState {
    with_env(app_dir, home, |env| (find_hooks(provider).unwrap().check)(env))
}

#[test]
fn installs_only_the_named_agent() {
    let root = temp_root("only");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    fs::create_dir_all(home.join(".claude")).unwrap();
    fs::create_dir_all(home.join(".codex")).unwrap();

    let result = install_in(&app_dir, &home, &["claudeCode".to_string()]).unwrap();

    assert_eq!(result.results.len(), 1);
    assert_eq!(result.results[0].provider, "claudeCode");
    assert_eq!(result.results[0].error, None);
    assert_eq!(state_of(&app_dir, &home, "claudeCode"), HookInstallState::Current);
    assert_eq!(state_of(&app_dir, &home, "codex"), HookInstallState::NotInstalled);
    assert!(app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME).exists());
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn an_unknown_agent_does_not_stop_the_others() {
    let root = temp_root("unknown");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    fs::create_dir_all(home.join(".claude")).unwrap();

    let providers = ["nope".to_string(), "claudeCode".to_string()];
    let result = install_in(&app_dir, &home, &providers).unwrap();

    assert!(result.results[0].error.as_deref().is_some_and(|error| error.contains("nope")));
    assert_eq!(result.results[1].error, None);
    assert_eq!(state_of(&app_dir, &home, "claudeCode"), HookInstallState::Current);
    assert_eq!(result.dsh_bridge, None);
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn uninstalls_only_the_named_agent() {
    let root = temp_root("uninstall");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    fs::create_dir_all(home.join(".claude")).unwrap();
    fs::create_dir_all(home.join(".codex")).unwrap();
    install_in(&app_dir, &home, &["claudeCode".to_string(), "codex".to_string()]).unwrap();

    uninstall_in(&app_dir, &home, "codex").unwrap();

    assert_eq!(state_of(&app_dir, &home, "codex"), HookInstallState::NotInstalled);
    assert_eq!(state_of(&app_dir, &home, "claudeCode"), HookInstallState::Current);
    assert!(app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME).exists());
    assert!(uninstall_in(&app_dir, &home, "nope").is_err());
    fs::remove_dir_all(&root).unwrap();
}
