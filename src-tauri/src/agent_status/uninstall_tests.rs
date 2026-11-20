use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Value};

use super::*;
use crate::agent_status::claude_hooks::{install_claude_code_status_hooks, ApprovalHook};
use crate::agent_status::hooks_state::HookInstallState;

fn temp_root(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-uninstall-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn make_env<'a>(home: &'a Path, running: &'a Path, status: &'a Path) -> HookEnv<'a> {
    HookEnv {
        home_dir: home,
        running_script: running,
        status_script: status,
    }
}

#[test]
fn uninstall_on_empty_home_creates_no_files() {
    let root = temp_root("empty");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    fs::create_dir_all(&home).unwrap();
    fs::create_dir_all(&app_dir).unwrap();

    uninstall_local_hooks_in(&app_dir, &home).unwrap();
    assert_eq!(fs::read_dir(&home).unwrap().count(), 0);
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn all_harnesses_uninstall_cleanly_while_keeping_user_configs() {
    let root = temp_root("all-harnesses");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    fs::create_dir_all(&app_dir).unwrap();
    install_agent_hook_scripts(&app_dir).unwrap();
    fs::write(app_dir.join("focusd-agent-running.cmd"), "@echo off\r\n").unwrap();
    fs::write(app_dir.join("fuyu-dsh-hooks.json"), "{}").unwrap();

    fs::create_dir_all(home.join(".codex")).unwrap();
    fs::write(
        home.join(".codex/config.toml"),
        "model = \"gpt-5\"\n\n# BEGIN FocuSD Agent Status Hooks\n[[hooks.Stop]]\n# END FocuSD Agent Status Hooks\n\n[profiles.dev]\nmodel = \"o3\"\n",
    )
    .unwrap();

    fs::create_dir_all(home.join(".claude")).unwrap();
    fs::write(
        home.join(".claude/settings.json"),
        r#"{"model":"opus","hooks":{"Stop":[{"hooks":[{"type":"command","command":"my-stop"}]}]}}"#,
    )
    .unwrap();

    fs::create_dir_all(home.join(".workbuddy")).unwrap();
    fs::write(
        home.join(".workbuddy/settings.json"),
        r#"{"sandbox":true,"hooks":{"Stop":[{"hooks":[{"type":"command","command":"wb-user"}]}]}}"#,
    )
    .unwrap();
    fs::create_dir_all(home.join(".workbuddy-ai")).unwrap();
    fs::write(home.join(".workbuddy-ai/settings.json"), r#"{"theme":"light"}"#).unwrap();

    fs::create_dir_all(home.join(".gemini/antigravity")).unwrap();
    fs::create_dir_all(home.join(".gemini/config")).unwrap();
    fs::write(
        home.join(".gemini/config/hooks.json"),
        r#"{"mine":{"enabled":true,"Stop":[{"type":"command","command":"keep-ag"}]}}"#,
    )
    .unwrap();

    fs::create_dir_all(home.join(".dsh/profiles/desktop")).unwrap();
    fs::write(
        home.join(".dsh/profiles/desktop/cordis.patch.yml"),
        "- { id: computer-use, disabled: false }\n",
    )
    .unwrap();

    fs::create_dir_all(home.join(".config/opencode/plugin")).unwrap();
    fs::create_dir_all(home.join(".local/share/opencode")).unwrap();
    fs::write(home.join(".config/opencode/plugin/other.js"), "export default {};\n").unwrap();

    fs::create_dir_all(home.join(".qoder")).unwrap();
    fs::write(home.join(".qoder/settings.json"), r#"{"theme":"dark"}"#).unwrap();

    fs::create_dir_all(home.join(".codebuddy")).unwrap();
    fs::write(
        home.join(".codebuddy/settings.json"),
        r#"{"hooks":{"Notification":[{"matcher":"*","hooks":[{"type":"command","command":"cb-keep"}]}]}}"#,
    )
    .unwrap();

    fs::create_dir_all(home.join(".qwen")).unwrap();
    fs::write(home.join(".qwen/settings.json"), r#"{"vim":true}"#).unwrap();

    fs::create_dir_all(home.join(".trae")).unwrap();
    fs::create_dir_all(home.join(".trae-cn")).unwrap();
    fs::write(
        home.join(".trae-cn/hooks.json"),
        r#"{"version":2,"hooks":{"Stop":[{"matcher":"*","hooks":[{"type":"command","command":"trae-keep"}]}]}}"#,
    )
    .unwrap();

    fs::create_dir_all(home.join(".zcode/cli")).unwrap();
    fs::write(home.join(".zcode/cli/config.json"), r#"{"model":"glm-5"}"#).unwrap();

    fs::create_dir_all(home.join(".kimi-code")).unwrap();
    fs::write(
        home.join(".kimi-code/config.toml"),
        "default_model = \"kimi\"\n\n[[hooks]]\nevent = \"Notification\"\ncommand = \"kimi-keep\"\n",
    )
    .unwrap();

    fs::create_dir_all(home.join(".config/mimocode/plugin")).unwrap();
    fs::create_dir_all(home.join(".local/share/mimocode")).unwrap();
    fs::write(home.join(".config/mimocode/plugin/keep.js"), "export default {};\n").unwrap();

    fs::create_dir_all(home.join(".grok/hooks")).unwrap();
    fs::write(home.join(".grok/hooks/other.json"), r#"{"hooks":{}}"#).unwrap();

    fs::create_dir_all(home.join(".copilot/hooks")).unwrap();
    fs::write(home.join(".copilot/hooks/other.json"), r#"{"version":1}"#).unwrap();

    fs::create_dir_all(home.join(".factory")).unwrap();
    fs::write(
        home.join(".factory/settings.json"),
        r#"{"model":"droid-1","hooks":{"Stop":[{"hooks":[{"type":"command","command":"droid-keep"}]}]}}"#,
    )
    .unwrap();

    fs::create_dir_all(home.join(".pi/agent/extensions")).unwrap();
    fs::write(home.join(".pi/agent/extensions/keep.js"), "export default () => {};\n").unwrap();

    fs::create_dir_all(home.join(".cursor")).unwrap();
    fs::write(
        home.join(".cursor/hooks.json"),
        r#"{"version":1,"hooks":{"beforeShellExecution":[{"command":"./mine.sh"}]}}"#,
    )
    .unwrap();

    let running = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = make_env(&home, &running, &status);

    let harnesses: Vec<_> = harness::with_hooks().collect();
    assert_eq!(harnesses.len(), 19);
    for (id, hooks) in &harnesses {
        (hooks.install)(&env).unwrap_or_else(|err| panic!("install {id}: {err}"));
    }
    let approval = ApprovalHook;
    install_claude_code_status_hooks(
        &home.join(".claude/settings.json"),
        &running,
        &status,
        Some(&approval),
        false,
    )
    .unwrap();

    for (id, hooks) in &harnesses {
        if *id != "claudeCode" {
            assert_eq!((hooks.check)(&env), HookInstallState::Current, "{id}");
        }
    }

    uninstall_local_hooks_in(&app_dir, &home).unwrap();

    for (id, hooks) in &harnesses {
        assert!(!(hooks.check)(&env).is_installed(), "{id} still installed");
    }
    assert!(!running.exists() && !status.exists());
    assert!(!app_dir.join("focusd-agent-running.cmd").exists());
    assert!(!app_dir.join("dsh-plugin").exists());
    assert!(!app_dir.join("fuyu-dsh-hooks.json").exists());
    assert!(!home.join(".dsh/cordis.patch.yml").exists());
    assert_eq!(
        fs::read_to_string(home.join(".dsh/profiles/desktop/cordis.patch.yml")).unwrap(),
        "- { id: computer-use, disabled: false }\n"
    );

    let codex_toml = fs::read_to_string(home.join(".codex/config.toml")).unwrap();
    assert!(codex_toml.contains("model = \"gpt-5\"") && codex_toml.contains("[profiles.dev]"));
    assert!(!codex_toml.contains("fuyu-agent-") && !codex_toml.contains("FocuSD"));

    let claude_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".claude/settings.json")).unwrap()).unwrap();
    assert_eq!(claude_json, json!({"model": "opus", "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "my-stop"}]}]}}));

    let wb_ai: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".workbuddy-ai/settings.json")).unwrap()).unwrap();
    assert_eq!(wb_ai, json!({"theme": "light"}));

    let qoder_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".qoder/settings.json")).unwrap()).unwrap();
    assert_eq!(qoder_json, json!({"theme": "dark"}));

    let qwen_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".qwen/settings.json")).unwrap()).unwrap();
    assert_eq!(qwen_json, json!({"vim": true}));

    let trae_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".trae/hooks.json")).unwrap()).unwrap();
    assert_eq!(trae_json, json!({"version": 1}));
    let trae_cn_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".trae-cn/hooks.json")).unwrap()).unwrap();
    assert_eq!(
        trae_cn_json,
        json!({"version": 2, "hooks": {"Stop": [{"matcher": "*", "hooks": [{"type": "command", "command": "trae-keep"}]}]}})
    );

    let zcode_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".zcode/cli/config.json")).unwrap()).unwrap();
    assert_eq!(zcode_json, json!({"model": "glm-5"}));

    let ag_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".gemini/config/hooks.json")).unwrap()).unwrap();
    assert_eq!(ag_json, json!({"mine": {"enabled": true, "Stop": [{"type": "command", "command": "keep-ag"}]}}));

    let kimi_toml = fs::read_to_string(home.join(".kimi-code/config.toml")).unwrap();
    assert!(kimi_toml.contains("default_model = \"kimi\"") && kimi_toml.contains("command = \"kimi-keep\""));
    assert!(!kimi_toml.contains("fuyu-agent-"));

    assert!(!home.join(".config/opencode/plugin/fuyu-island.js").exists());
    assert!(home.join(".config/opencode/plugin/other.js").is_file());
    assert!(!home.join(".config/mimocode/plugin/fuyu-island.js").exists());
    assert!(home.join(".config/mimocode/plugin/keep.js").is_file());
    assert!(!home.join(".grok/hooks/fuyu-island.json").exists());
    assert!(home.join(".grok/hooks/other.json").is_file());
    assert!(!home.join(".copilot/hooks/fuyu-island.json").exists());
    assert!(home.join(".copilot/hooks/other.json").is_file());
    assert!(!home.join(".pi/agent/extensions/fuyu-island.js").exists());
    assert!(home.join(".pi/agent/extensions/keep.js").is_file());
    let cursor_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".cursor/hooks.json")).unwrap()).unwrap();
    assert_eq!(cursor_json, json!({"version": 1, "hooks": {"beforeShellExecution": [{"command": "./mine.sh"}]}}));

    let droid_json: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".factory/settings.json")).unwrap()).unwrap();
    assert_eq!(droid_json, json!({"model": "droid-1", "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "droid-keep"}]}]}}));

    let qoder_before = fs::read_to_string(home.join(".qoder/settings.json")).unwrap();
    uninstall_local_hooks_in(&app_dir, &home).unwrap();
    assert_eq!(fs::read_to_string(home.join(".qoder/settings.json")).unwrap(), qoder_before);

    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn zcode_and_droid_hooks_json_preserve_extra_user_keys() {
    let root = temp_root("zcode-droid");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    let running = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = make_env(&home, &running, &status);

    fs::create_dir_all(home.join(".zcode/cli")).unwrap();
    fs::write(
        home.join(".zcode/cli/config.json"),
        r#"{"hooks":{"enabled":false,"timeoutMs":60000,"events":{}}}"#,
    )
    .unwrap();
    let zcode_hooks = crate::agent_status::zcode::HARNESS.hooks.as_ref().unwrap();
    (zcode_hooks.install)(&env).unwrap();
    (zcode_hooks.uninstall)(&env).unwrap();
    let zcode_after: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".zcode/cli/config.json")).unwrap()).unwrap();
    assert_eq!(zcode_after, json!({"hooks": {"enabled": true, "timeoutMs": 60000}}));

    fs::create_dir_all(home.join(".factory")).unwrap();
    fs::write(
        home.join(".factory/hooks.json"),
        r#"{"PreToolUse":[{"matcher":"Execute","hooks":[{"type":"command","command":"audit"}]}]}"#,
    )
    .unwrap();
    let droid_hooks = crate::agent_status::droid::HARNESS.hooks.as_ref().unwrap();
    (droid_hooks.install)(&env).unwrap();
    (droid_hooks.uninstall)(&env).unwrap();
    let droid_after: Value =
        serde_json::from_str(&fs::read_to_string(home.join(".factory/hooks.json")).unwrap()).unwrap();
    assert_eq!(
        droid_after,
        json!({"PreToolUse": [{"matcher": "Execute", "hooks": [{"type": "command", "command": "audit"}]}]})
    );

    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn dsh_uninstall_removes_fuyu_entry_from_custom_and_profile_patches() {
    let root = temp_root("dsh-custom");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    let running = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = make_env(&home, &running, &status);

    let dsh_home = home.join(".dsh");
    let profile = dsh_home.join("profiles/dev");
    fs::create_dir_all(&profile).unwrap();
    let custom = "- id: session-title\n  config:\n    maxTitleBytes: 120\n";
    fs::write(dsh_home.join("cordis.patch.yml"), custom).unwrap();

    crate::agent_status::dsh_hooks::install_hooks(&env).unwrap();
    let snippet = crate::agent_status::dsh_hooks::bridge_lines(&env).unwrap();
    fs::write(dsh_home.join("cordis.patch.yml"), format!("{custom}{snippet}")).unwrap();
    fs::write(
        profile.join("cordis.patch.yml"),
        "- insert:\n    - id: other-plugin\n      name: \"other\"\n    - id: fuyu-island\n      name: \"@fuyu/dsh-plugin\"\n",
    )
    .unwrap();
    fs::write(
        profile.join("package.json"),
        r#"{"dsh":{"profile":{"bundles":["keep-pkg","@fuyu/dsh-plugin"]}}}"#,
    )
    .unwrap();
    assert_eq!(crate::agent_status::dsh_hooks::hooks_state(&env), HookInstallState::Current);

    crate::agent_status::dsh_hooks::uninstall_hooks(&env).unwrap();
    assert_eq!(crate::agent_status::dsh_hooks::hooks_state(&env), HookInstallState::NotInstalled);
    assert_eq!(fs::read_to_string(dsh_home.join("cordis.patch.yml")).unwrap(), custom);
    assert_eq!(
        fs::read_to_string(profile.join("cordis.patch.yml")).unwrap(),
        "- insert:\n    - id: other-plugin\n      name: \"other\"\n"
    );
    let manifest: Value = serde_json::from_str(&fs::read_to_string(profile.join("package.json")).unwrap()).unwrap();
    assert_eq!(manifest["dsh"]["profile"]["bundles"], json!(["keep-pkg"]));

    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn remote_uninstall_strips_claude_and_antigravity_hooks_without_touching_user_entries() {
    use crate::agent_status::antigravity_remote;
    use crate::agent_status::remote_setup::{with_remote_hooks, without_remote_hooks, RemoteApproval};

    assert_eq!(without_remote_hooks("").unwrap(), "");
    assert_eq!(antigravity_remote::without_remote_hooks("").unwrap(), "");

    let approval = RemoteApproval {
        host: "srv".into(),
        path: "claude/permission-request".into(),
        question_path: "claude/ask-user-question".into(),
        activity_path: "claude/activity".into(),
        antigravity_path: "antigravity/pre-tool-use".into(),
    };
    let installed_only = with_remote_hooks(r#"{"model":"opus"}"#, Some(&approval)).unwrap();
    let cleaned_only: Value = serde_json::from_str(&without_remote_hooks(&installed_only).unwrap()).unwrap();
    assert_eq!(cleaned_only, json!({"model": "opus"}));

    let with_user = with_remote_hooks(
        r#"{"model":"opus","hooks":{"Notification":[{"hooks":[{"type":"command","command":"notify-send hi"}]}]}}"#,
        Some(&approval),
    )
    .unwrap();
    let cleaned_user: Value = serde_json::from_str(&without_remote_hooks(&with_user).unwrap()).unwrap();
    assert_eq!(
        cleaned_user,
        json!({"model": "opus", "hooks": {"Notification": [{"hooks": [{"type": "command", "command": "notify-send hi"}]}]}})
    );

    let ag_installed = antigravity_remote::with_remote_hooks(
        r#"{"mine":{"enabled":true}}"#,
        Some(&approval),
    )
    .unwrap();
    let ag_cleaned: Value =
        serde_json::from_str(&antigravity_remote::without_remote_hooks(&ag_installed).unwrap()).unwrap();
    assert_eq!(ag_cleaned, json!({"mine": {"enabled": true}}));
}

#[test]
fn app_uninstall_keeps_recovery_marker_and_restores_on_reinstall() {
    let root = temp_root("reinstall");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    fs::create_dir_all(home.join(".claude/rules")).unwrap();
    fs::create_dir_all(home.join(".grok/rules")).unwrap();
    fs::create_dir_all(&app_dir).unwrap();

    fs::write(home.join(".claude/CLAUDE.md"), "# User note\n").unwrap();
    fs::write(
        home.join(".claude/rules/fuyu-reply-marker.md"),
        "<!-- fuyu: reply marker v4 -->\nold\n<!-- /fuyu: reply marker -->\n",
    )
    .unwrap();

    install_agent_hook_scripts(&app_dir).unwrap();
    let running = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = make_env(&home, &running, &status);
    for (_, hooks) in harness::with_hooks() {
        (hooks.install)(&env).unwrap();
    }
    reply_marker::set_local(&home, true).unwrap();
    assert!(home.join(".grok/rules/fuyu-island.md").is_file());
    assert!(reply_marker::is_installed_in(&home));

    cleanup_for_app_uninstall(&app_dir, &home, false);

    assert!(!running.exists() && !status.exists());
    assert!(!reply_marker::is_installed_in(&home));
    assert!(!home.join(".grok/rules/fuyu-island.md").exists());
    assert!(!home.join(".claude/rules/fuyu-reply-marker.md").exists());
    assert_eq!(fs::read_to_string(home.join(".claude/CLAUDE.md")).unwrap(), "# User note\n");
    let marker: Value =
        serde_json::from_str(&fs::read_to_string(app_dir.join(UNINSTALLED_HOOKS_FILE_NAME)).unwrap()).unwrap();
    assert_eq!(marker, json!({"hooks": true, "replyMarker": true}));

    assert!(restore_hooks_after_reinstall(&app_dir, &home).unwrap());
    assert!(!app_dir.join(UNINSTALLED_HOOKS_FILE_NAME).exists());
    assert!(running.is_file() && status.is_file());
    assert!(reply_marker::is_installed_in(&home));
    assert!(home.join(".grok/rules/fuyu-island.md").is_file());
    assert!((crate::agent_status::grok::HARNESS.hooks.as_ref().unwrap().check)(&env).is_installed());
    assert!(!restore_hooks_after_reinstall(&app_dir, &home).unwrap());

    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn app_uninstall_with_delete_data_removes_editor_extensions_and_skips_marker() {
    let root = temp_root("delete-data");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    fs::create_dir_all(&app_dir).unwrap();

    for editor in [".vscode", ".vscode-insiders", ".cursor", ".windsurf", ".vscodium", ".trae", ".kiro"] {
        let ext = home.join(editor).join("extensions");
        fs::create_dir_all(ext.join("tixxin.fuyu-0.4.0")).unwrap();
        fs::create_dir_all(ext.join("focusd.island-0.1.0")).unwrap();
        fs::create_dir_all(ext.join("ms-python.python-2026.1.0")).unwrap();
    }
    fs::create_dir_all(home.join(".grok/rules")).unwrap();
    fs::write(
        home.join(".grok/rules/fuyu-island.md"),
        "# Custom Grok Rule\n\n<!-- fuyu: reply marker v5 -->\nbody\n<!-- /fuyu: reply marker -->\n",
    )
    .unwrap();

    cleanup_for_app_uninstall(&app_dir, &home, true);

    assert!(!app_dir.join(UNINSTALLED_HOOKS_FILE_NAME).exists());
    assert_eq!(fs::read_to_string(home.join(".grok/rules/fuyu-island.md")).unwrap(), "# Custom Grok Rule\n");
    for editor in [".vscode", ".vscode-insiders", ".cursor", ".windsurf", ".vscodium", ".trae", ".kiro"] {
        let ext = home.join(editor).join("extensions");
        assert!(!ext.join("tixxin.fuyu-0.4.0").exists(), "{editor}");
        assert!(!ext.join("focusd.island-0.1.0").exists(), "{editor}");
        assert!(ext.join("ms-python.python-2026.1.0").is_dir(), "{editor}");
    }

    fs::remove_dir_all(&root).unwrap();
}

#[cfg(unix)]
#[test]
fn fail_open_commands_exit_zero_when_scripts_are_missing_and_run_when_present() {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let root = temp_root("fail-open");
    let missing_running = root.join("missing/fuyu-agent-running.sh");
    let missing_status = root.join("missing/fuyu-agent-status.sh");

    for command in [
        crate::agent_status::codex_hooks::agent_running_command(&missing_running, "codex"),
        crate::agent_status::codex_hooks::agent_status_command(&missing_status, "codex", "completed"),
        crate::agent_status::copilot_hooks::hooks_config(&make_env(&root, &missing_running, &missing_status))["hooks"]["Stop"][0]["bash"]
            .as_str()
            .unwrap()
            .to_string(),
    ] {
        let out = Command::new("/bin/sh").arg("-c").arg(&command).output().unwrap();
        assert!(out.status.success(), "{command}: {:?}", out);
        assert!(out.stdout.is_empty() && out.stderr.is_empty());
    }

    let claude_entry = crate::agent_status::claude_hooks::claude_code_running_hook_entry(&missing_running);
    let claude_command = claude_entry["hooks"][0]["command"].as_str().unwrap();
    let out = Command::new("/bin/sh").arg("-c").arg(claude_command).output().unwrap();
    assert!(out.status.success());
    assert!(out.stdout.is_empty() && out.stderr.is_empty());

    let real_script = root.join("fuyu-agent-running.sh");
    fs::write(&real_script, "#!/bin/sh\nread line\nprintf '%s:%s' \"$1\" \"$line\"\n").unwrap();
    let real_entry = crate::agent_status::claude_hooks::claude_code_running_hook_entry(&real_script);
    let mut child = Command::new("/bin/sh")
        .arg("-c")
        .arg(real_entry["hooks"][0]["command"].as_str().unwrap())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(b"hello\n").unwrap();
    let out = child.wait_with_output().unwrap();
    assert!(out.status.success());
    assert_eq!(String::from_utf8_lossy(&out.stdout), "claudeCode:hello");

    fs::remove_dir_all(&root).unwrap();
}
