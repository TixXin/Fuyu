use std::{
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

use super::super::harness::{HookEnv, Hooks};
use super::super::hooks_state::HookInstallState;
use super::super::write_text_file;
use super::{config_dir, data_dir};

pub(in crate::agent_status) const PLUGIN_FILE_NAME: &str = "fuyu-island.js";
const PLUGIN_TEMPLATE: &str = include_str!("hooks/fuyu-opencode-plugin.js");
const DIR_PLACEHOLDER: &str = "\"__FUYU_DIR__\"";

pub(super) const HOOKS: Hooks = Hooks { install: install_hooks, check: hooks_state };

fn process_env(name: &str) -> Option<OsString> {
    std::env::var_os(name)
}

fn plugin_path(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> PathBuf {
    config_dir(home_dir, env).join("plugin").join(PLUGIN_FILE_NAME)
}

fn present(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> bool {
    config_dir(home_dir, env).is_dir() || data_dir(home_dir, env).is_dir()
}

fn app_dir<'a>(env: &HookEnv<'a>) -> &'a Path {
    env.status_script.parent().unwrap_or(env.status_script)
}

pub(super) fn plugin_text(app_dir: &Path) -> String {
    let dir = serde_json::to_string(&app_dir.to_string_lossy()).unwrap_or_else(|_| "\"\"".to_string());
    PLUGIN_TEMPLATE.replace(DIR_PLACEHOLDER, &dir)
}

fn install_hooks(env: &HookEnv) -> Result<(), String> {
    install_with(env, &process_env)
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    state_with(env, &process_env)
}

pub(super) fn install_with(env: &HookEnv, vars: &impl Fn(&str) -> Option<OsString>) -> Result<(), String> {
    if !present(env.home_dir, vars) {
        return Ok(());
    }
    write_text_file(&plugin_path(env.home_dir, vars), &plugin_text(app_dir(env)))
}

pub(super) fn state_with(env: &HookEnv, vars: &impl Fn(&str) -> Option<OsString>) -> HookInstallState {
    if !present(env.home_dir, vars) {
        return HookInstallState::Absent;
    }
    match fs::read_to_string(plugin_path(env.home_dir, vars)) {
        Err(_) => HookInstallState::NotInstalled,
        Ok(text) if text.replace("\r\n", "\n") == plugin_text(app_dir(env)).replace("\r\n", "\n") => HookInstallState::Current,
        Ok(_) => HookInstallState::Outdated,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fuyu-opencode-plugin-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn installs_the_plugin_only_where_opencode_lives() {
        let home = home("install");
        let fuyu = home.join("Fuyu \"data\"");
        let running = fuyu.join(crate::agent_status::AGENT_RUNNING_SCRIPT_FILE_NAME);
        let status = fuyu.join(crate::agent_status::AGENT_STATUS_SCRIPT_FILE_NAME);
        let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
        let config = home.join("xdg-config");
        let vars = |name: &str| (name == "XDG_CONFIG_HOME").then(|| config.clone().into_os_string());

        install_with(&env, &vars).unwrap();
        assert_eq!(state_with(&env, &vars), HookInstallState::Absent);
        assert!(!config.join("opencode").exists());

        fs::create_dir_all(home.join(".local/share/opencode")).unwrap();
        assert_eq!(state_with(&env, &vars), HookInstallState::NotInstalled);
        install_with(&env, &vars).unwrap();
        let path = config.join("opencode/plugin").join(PLUGIN_FILE_NAME);
        let text = fs::read_to_string(&path).unwrap();
        assert!(!text.contains("__FUYU_DIR__"));
        let quoted = serde_json::to_string(&fuyu.to_string_lossy()).unwrap();
        assert!(text.contains(&format!("const FUYU_DIR = {quoted};")));
        assert!(text.contains("\"/opencode/permission\""));
        assert!(text.contains("export default { id: \"fuyu-island\", server, setup"));
        assert_eq!(state_with(&env, &vars), HookInstallState::Current);

        fs::write(&path, text.replace("\r\n", "\n").replace('\n', "\r\n")).unwrap();
        assert_eq!(state_with(&env, &vars), HookInstallState::Current);
        fs::write(&path, "export default {}").unwrap();
        assert_eq!(state_with(&env, &vars), HookInstallState::Outdated);
        fs::remove_dir_all(&home).unwrap();
    }
}
