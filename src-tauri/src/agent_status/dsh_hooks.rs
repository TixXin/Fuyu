use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Value};

use super::harness::HookEnv;
use super::hooks_state::HookInstallState;
use super::{dsh, write_text_file};

pub(super) const PLUGIN_DIR_NAME: &str = "dsh-plugin";
pub(super) const ENTRY_FILE_NAME: &str = "index.js";
const MANIFEST_FILE_NAME: &str = "package.json";
const PATCH_FILE_NAME: &str = "cordis.patch.yml";
const PROFILE_FILES: [&str; 2] = ["cordis.patch.yml", "cordis.yml"];
const PLUGIN_PACKAGE_NAME: &str = "@fuyu/dsh-plugin";
const PLUGIN_ID: &str = "fuyu-island";
const LEGACY_HOOKS_FILE_NAME: &str = "fuyu-dsh-hooks.json";
const LEGACY_BRIDGE_PACKAGE: &str = "dsh-hooks-claude-code";
const PLUGIN_TEMPLATE: &str = include_str!("hooks/fuyu-dsh-plugin.js");
const DIR_PLACEHOLDER: &str = "\"__FUYU_DIR__\"";

fn app_dir<'a>(env: &HookEnv<'a>) -> &'a Path {
    env.status_script.parent().unwrap_or(env.status_script)
}

fn plugin_dir(env: &HookEnv) -> PathBuf {
    app_dir(env).join(PLUGIN_DIR_NAME)
}

fn entry_file(env: &HookEnv) -> PathBuf {
    plugin_dir(env).join(ENTRY_FILE_NAME)
}

fn legacy_hooks_file(env: &HookEnv) -> PathBuf {
    env.status_script.with_file_name(LEGACY_HOOKS_FILE_NAME)
}

fn installed_homes(home_dir: &Path) -> Vec<PathBuf> {
    dsh::homes(home_dir).into_iter().filter(|home| home.is_dir()).collect()
}

pub(super) fn plugin_text(dir: &Path) -> String {
    let quoted = serde_json::to_string(&dir.to_string_lossy()).unwrap_or_else(|_| "\"\"".to_string());
    PLUGIN_TEMPLATE.replace(DIR_PLACEHOLDER, &quoted)
}

fn manifest_text() -> String {
    serde_json::to_string_pretty(&json!({
        "name": PLUGIN_PACKAGE_NAME,
        "version": "0.1.0",
        "private": true,
        "type": "module",
        "main": "./index.js",
        "exports": { ".": "./index.js" },
        "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
    }))
    .unwrap_or_default()
}

fn bundle_patch_text() -> String {
    format!("- insert:\n    - id: {PLUGIN_ID}\n      name: \"{PLUGIN_PACKAGE_NAME}\"\n")
}

fn home_patch_snippet(entry: &Path) -> Option<String> {
    let quoted = serde_json::to_string(&entry.to_string_lossy()).ok()?;
    Some(format!("- insert:\n    - id: {PLUGIN_ID}\n      name: {quoted}\n"))
}

fn normalized_eq(left: &str, right: &str) -> bool {
    left.replace("\r\n", "\n").trim_end() == right.replace("\r\n", "\n").trim_end()
}

fn plugin_files_state(env: &HookEnv) -> HookInstallState {
    let dir = plugin_dir(env);
    let expected = [
        (dir.join(ENTRY_FILE_NAME), plugin_text(app_dir(env))),
        (dir.join(MANIFEST_FILE_NAME), manifest_text()),
        (dir.join(PATCH_FILE_NAME), bundle_patch_text()),
    ];
    let mut any_exists = legacy_hooks_file(env).is_file();
    let mut all_match = !any_exists;
    for (path, content) in &expected {
        match fs::read_to_string(path) {
            Ok(actual) => {
                any_exists = true;
                if !normalized_eq(&actual, content) {
                    all_match = false;
                }
            }
            Err(_) => all_match = false,
        }
    }
    if all_match {
        HookInstallState::Current
    } else if any_exists {
        HookInstallState::Outdated
    } else {
        HookInstallState::NotInstalled
    }
}

fn profile_patch_files(dsh_home: &Path) -> Vec<PathBuf> {
    fs::read_dir(dsh_home.join("profiles"))
        .into_iter()
        .flatten()
        .flatten()
        .flat_map(|profile| PROFILE_FILES.map(|name| profile.path().join(name)))
        .filter(|path| path.is_file())
        .collect()
}

fn profile_manifests(dsh_home: &Path) -> Vec<PathBuf> {
    fs::read_dir(dsh_home.join("profiles"))
        .into_iter()
        .flatten()
        .flatten()
        .map(|profile| profile.path().join(MANIFEST_FILE_NAME))
        .filter(|path| path.is_file())
        .collect()
}

fn mentions_current_entry(text: &str, entry: &Path) -> bool {
    let raw = entry.to_string_lossy();
    let slashed = raw.replace('\\', "/");
    let escaped = serde_json::to_string(&raw).unwrap_or_default();
    text.contains(PLUGIN_PACKAGE_NAME)
        || text.contains(raw.as_ref())
        || text.contains(&slashed)
        || (!escaped.is_empty() && text.contains(&escaped))
}

fn home_mounted(dsh_home: &Path, entry: &Path) -> bool {
    let home_patch = dsh_home.join(PATCH_FILE_NAME);
    if fs::read_to_string(&home_patch).is_ok_and(|text| mentions_current_entry(&text, entry)) {
        return true;
    }
    if profile_patch_files(dsh_home)
        .into_iter()
        .any(|path| fs::read_to_string(path).is_ok_and(|text| mentions_current_entry(&text, entry)))
    {
        return true;
    }
    profile_manifests(dsh_home).into_iter().any(|path| {
        fs::read_to_string(path)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .and_then(|manifest| manifest["dsh"]["profile"]["bundles"].as_array().cloned())
            .is_some_and(|bundles| bundles.iter().any(|item| item.as_str() == Some(PLUGIN_PACKAGE_NAME)))
    })
}

fn home_has_stale_reference(dsh_home: &Path) -> bool {
    let mut files = vec![dsh_home.join(PATCH_FILE_NAME)];
    files.extend(profile_patch_files(dsh_home));
    files.into_iter().any(|path| {
        fs::read_to_string(path).is_ok_and(|text| {
            text.contains(LEGACY_BRIDGE_PACKAGE)
                || text.contains(LEGACY_HOOKS_FILE_NAME)
                || text.contains(PLUGIN_DIR_NAME)
                || text.contains(PLUGIN_ID)
        })
    })
}

fn is_fuyu_managed_home_patch(text: &str) -> bool {
    let normalized = text.replace("\r\n", "\n");
    let trimmed = normalized.trim();
    if trimmed.is_empty() {
        return true;
    }
    let lines: Vec<&str> = trimmed.lines().collect();
    lines.len() == 3
        && lines[0].trim_end() == "- insert:"
        && lines[1].trim() == format!("- id: {PLUGIN_ID}")
        && lines[2].trim_start().starts_with("name:")
}

pub(super) fn hooks_state(env: &HookEnv) -> HookInstallState {
    let homes = installed_homes(env.home_dir);
    if homes.is_empty() {
        return HookInstallState::Absent;
    }
    let files_state = plugin_files_state(env);
    if files_state != HookInstallState::Current {
        return files_state;
    }
    let entry = entry_file(env);
    if homes.iter().all(|home| home_mounted(home, &entry)) {
        return HookInstallState::Current;
    }
    if homes.iter().any(|home| home_has_stale_reference(home)) {
        HookInstallState::Outdated
    } else {
        HookInstallState::NotInstalled
    }
}

pub(super) fn install_hooks(env: &HookEnv) -> Result<(), String> {
    let homes = installed_homes(env.home_dir);
    if homes.is_empty() {
        return Ok(());
    }
    let dir = plugin_dir(env);
    let entry = entry_file(env);
    write_text_file(&dir.join(MANIFEST_FILE_NAME), &manifest_text())?;
    write_text_file(&dir.join(PATCH_FILE_NAME), &bundle_patch_text())?;
    write_text_file(&entry, &plugin_text(app_dir(env)))?;
    let _ = fs::remove_file(legacy_hooks_file(env));

    if let Some(snippet) = home_patch_snippet(&entry) {
        for home in &homes {
            if home_mounted(home, &entry) {
                continue;
            }
            let patch = home.join(PATCH_FILE_NAME);
            let can_write = match fs::read_to_string(&patch) {
                Ok(existing) => is_fuyu_managed_home_patch(&existing),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => true,
                Err(_) => false,
            };
            if can_write {
                write_text_file(&patch, &snippet)?;
            }
        }
    }
    Ok(())
}

pub(super) fn bridge_lines(env: &HookEnv) -> Option<String> {
    let homes = installed_homes(env.home_dir);
    let entry = entry_file(env);
    if homes.is_empty() || homes.iter().all(|home| home_mounted(home, &entry)) {
        return None;
    }
    home_patch_snippet(&entry)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fuyu-dsh-hooks-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn generates_cordis_plugin_and_mounts_home_patch_when_safe() {
        let home = home("auto-mount");
        let fuyu = home.join(".fuyu");
        let running = fuyu.join(crate::agent_status::AGENT_RUNNING_SCRIPT_FILE_NAME);
        let status = fuyu.join(crate::agent_status::AGENT_STATUS_SCRIPT_FILE_NAME);
        let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };

        install_hooks(&env).unwrap();
        assert!(!plugin_dir(&env).exists());
        assert_eq!(hooks_state(&env), HookInstallState::Absent);
        assert_eq!(bridge_lines(&env), None);

        let profile = home.join(".dsh").join("profiles").join("desktop");
        fs::create_dir_all(&profile).unwrap();
        fs::write(profile.join("cordis.patch.yml"), "- { id: computer-use, disabled: false }\n").unwrap();
        fs::create_dir_all(&fuyu).unwrap();
        fs::write(legacy_hooks_file(&env), "{}").unwrap();
        assert_eq!(hooks_state(&env), HookInstallState::Outdated);

        install_hooks(&env).unwrap();
        assert!(!legacy_hooks_file(&env).exists());
        let script = fs::read_to_string(entry_file(&env)).unwrap();
        assert!(!script.contains("__FUYU_DIR__"));
        assert!(script.contains("\"/dsh/permission\""));
        assert!(script.contains("\"approval/request\""));
        let home_patch = fs::read_to_string(home.join(".dsh").join("cordis.patch.yml")).unwrap();
        assert!(home_patch.contains("- insert:") && home_patch.contains("fuyu-island"));
        assert_eq!(fs::read_to_string(profile.join("cordis.patch.yml")).unwrap(), "- { id: computer-use, disabled: false }\n");
        assert_eq!(bridge_lines(&env), None);
        assert_eq!(hooks_state(&env), HookInstallState::Current);

        let moved_fuyu = home.join(".fuyu-moved");
        let moved_running = moved_fuyu.join(crate::agent_status::AGENT_RUNNING_SCRIPT_FILE_NAME);
        let moved_status = moved_fuyu.join(crate::agent_status::AGENT_STATUS_SCRIPT_FILE_NAME);
        let moved_env = HookEnv { home_dir: &home, running_script: &moved_running, status_script: &moved_status };
        install_hooks(&moved_env).unwrap();
        assert_eq!(hooks_state(&moved_env), HookInstallState::Current);
        fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn preserves_custom_home_patch_and_returns_snippet_until_mounted() {
        let home = home("custom-patch");
        let fuyu = home.join(".fuyu");
        let running = fuyu.join(crate::agent_status::AGENT_RUNNING_SCRIPT_FILE_NAME);
        let status = fuyu.join(crate::agent_status::AGENT_STATUS_SCRIPT_FILE_NAME);
        let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };

        let dsh_home = home.join(".dsh");
        fs::create_dir_all(&dsh_home).unwrap();
        let custom = "- id: session-title\n  config:\n    maxTitleBytes: 120\n";
        fs::write(dsh_home.join("cordis.patch.yml"), custom).unwrap();

        install_hooks(&env).unwrap();
        assert_eq!(fs::read_to_string(dsh_home.join("cordis.patch.yml")).unwrap(), custom);
        assert_eq!(hooks_state(&env), HookInstallState::NotInstalled);
        let lines = bridge_lines(&env).unwrap();
        assert!(lines.contains("- insert:") && lines.contains("fuyu-island"));

        fs::write(dsh_home.join("cordis.patch.yml"), format!("{custom}{lines}")).unwrap();
        assert_eq!(bridge_lines(&env), None);
        assert_eq!(hooks_state(&env), HookInstallState::Current);

        fs::write(entry_file(&env), "export default () => {};\n").unwrap();
        assert_eq!(hooks_state(&env), HookInstallState::Outdated);
        fs::remove_dir_all(&home).unwrap();
    }
}
