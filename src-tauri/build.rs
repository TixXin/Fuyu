use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

const HARNESS_DIR: &str = "src/agent_status/harnesses";

fn main() {
    embed_windows_manifest();
    generate_compat_harnesses();
    let attributes = tauri_build::Attributes::new()
        .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
    if let Err(error) = tauri_build::try_build(attributes) {
        println!("{error:#}");
        std::process::exit(1);
    }
}

fn embed_windows_manifest() {
    println!("cargo:rerun-if-changed=windows-app-manifest.xml");
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if target_os != "windows" || target_env != "msvc" {
        return;
    }
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_default())
        .join("windows-app-manifest.xml");
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
}

fn generate_compat_harnesses() {
    println!("cargo:rerun-if-changed={HARNESS_DIR}");
    let mut files: Vec<PathBuf> = match fs::read_dir(HARNESS_DIR) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
            .collect(),
        Err(error) => panic!("{HARNESS_DIR}: {error}"),
    };
    files.sort();
    let mut code = String::new();
    for path in &files {
        println!("cargo:rerun-if-changed={}", path.display());
        let text = fs::read_to_string(path).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
        let harness: Value = serde_json::from_str(&text).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
        code.push_str(&compat_harness(path, &harness));
    }
    let out = PathBuf::from(env::var("OUT_DIR").unwrap_or_default()).join("compat_harnesses.rs");
    if let Err(error) = fs::write(&out, code) {
        panic!("{}: {error}", out.display());
    }
}

struct Spec<'a> {
    path: &'a Path,
    harness: &'a Value,
}

impl<'a> Spec<'a> {
    fn field(&self, pointer: &str) -> Option<&'a Value> {
        self.harness.pointer(pointer).filter(|value| !value.is_null())
    }

    fn text(&self, pointer: &str) -> &'a str {
        self.field(pointer)
            .and_then(Value::as_str)
            .unwrap_or_else(|| self.fail(&format!("{pointer} must be a string")))
    }

    fn one_of(&self, pointer: &str, choices: &[(&str, &str)]) -> String {
        let value = self.text(pointer);
        choices
            .iter()
            .find(|(name, _)| *name == value)
            .map(|(_, code)| (*code).to_string())
            .unwrap_or_else(|| self.fail(&format!("{pointer} is {value:?}, this step only supports {choices:?}")))
    }

    fn expect_event(&self, name: &str, wanted: Option<&str>) {
        let pointer = format!("/hooks/events/{name}");
        let actual = self.field(&pointer).and_then(Value::as_str);
        if actual != wanted {
            self.fail(&format!("{pointer} is {actual:?}, the claude-compatible hooks install {wanted:?}"));
        }
    }

    fn fail(&self, message: &str) -> ! {
        panic!("{}: {message}", self.path.display())
    }
}

fn compat_harness(path: &Path, harness: &Value) -> String {
    let spec = Spec { path, harness };
    let field = |pointer: &str| spec.field(pointer);
    let text = |pointer: &str| spec.text(pointer);
    let one_of = |pointer: &str, choices: &[(&str, &str)]| spec.one_of(pointer, choices);
    let expect_event = |name: &str, wanted: Option<&str>| spec.expect_event(name, wanted);

    if protocol_version(harness) != Some(1) {
        panic!("{}: /protocol must be 1", path.display());
    }
    let id = text("/id");
    let stem = path.file_stem().and_then(|stem| stem.to_str()).unwrap_or_default();
    if id != stem || !id.chars().all(|ch| ch.is_ascii_lowercase()) {
        panic!("{}: /id {id:?} must match the file name and be lowercase letters", path.display());
    }
    if text("/hooks/format") != "claude-compatible" {
        panic!("{}: only claude-compatible hooks are generated so far", path.display());
    }
    let label = match field("/name") {
        Some(Value::String(name)) => name.as_str(),
        _ => text("/name/en"),
    };
    let homes: Vec<String> = field("/forms/cli/home")
        .and_then(Value::as_array)
        .unwrap_or_else(|| panic!("{}: /forms/cli/home must be a list", path.display()))
        .iter()
        .map(|home| {
            let dir = home["path"].as_str().and_then(|path| path.strip_prefix("~/"));
            match (dir, home["env"].as_str()) {
                (Some(dir), Some(env)) if !dir.contains('/') => {
                    format!("super::claude_compat::Home {{ dir: {dir:?}, env: {env:?} }}")
                }
                _ => panic!("{}: each /forms/cli/home needs a \"~/<dir>\" path and an env", path.display()),
            }
        })
        .collect();
    let chats = match field("/sessions/chats") {
        Some(_) => format!("Some({:?})", text("/sessions/chats")),
        None => "None".to_string(),
    };
    let records = one_of(
        "/sessions/format",
        &[("claude-jsonl", "Claude"), ("codebuddy-jsonl", "CodeBuddy"), ("qwen-jsonl", "Qwen")],
    );
    let prompt_files = field("/replyMarker/promptFiles").and_then(Value::as_array);
    let prompt_file = match prompt_files.map(Vec::as_slice) {
        Some([Value::String(file)]) => file.as_str(),
        _ => panic!("{}: /replyMarker/promptFiles must hold exactly one file", path.display()),
    };
    let waiting = one_of(
        "/hooks/waitingKind",
        &[("permissionRequest", "PermissionRequest"), ("permissionPrompt", "PermissionPrompt")],
    );
    let reply = one_of(
        "/approval/reply",
        &[("permissionRequest", "PermissionRequest"), ("behavior", "Behavior"), ("none", "None")],
    );
    let aliases: Vec<String> = match field("/hooks/inputAliases") {
        Some(Value::Object(map)) => map
            .iter()
            .map(|(from, to)| match to.as_str() {
                Some(to) => format!("({from:?}, {to:?})"),
                None => panic!("{}: /hooks/inputAliases/{from} must be a string", path.display()),
            })
            .collect(),
        Some(_) => panic!("{}: /hooks/inputAliases must be an object", path.display()),
        None => Vec::new(),
    };

    expect_event("start", Some("UserPromptSubmit"));
    let activity = field("/hooks/events/activity").and_then(Value::as_array).map(Vec::as_slice);
    if !matches!(activity, Some([Value::String(event)]) if event == "PreToolUse") {
        panic!("{}: /hooks/events/activity must be [\"PreToolUse\"]", path.display());
    }
    expect_event("stop", Some("Stop"));
    expect_event("failed", Some("StopFailure"));
    expect_event("waiting", Some(if waiting == "PermissionRequest" { "PermissionRequest" } else { "Notification" }));
    expect_event("approval", (reply != "None").then_some("PermissionRequest"));

    format!(
        "claude_compat::compat_harness!({id}, {id:?}, super::claude_compat::Compat {{\n    \
         provider: PROVIDER,\n    \
         label: {label:?},\n    \
         homes: &[{homes}],\n    \
         chats: {chats},\n    \
         records: super::claude_compat::Records::{records},\n    \
         prompt_file: {prompt_file:?},\n    \
         waiting: super::claude_compat::Waiting::{waiting},\n    \
         hooks_file: {hooks_file:?},\n    \
         reply: super::claude_compat::Reply::{reply},\n    \
         aliases: &[{aliases}],\n\
         }});\n",
        homes = homes.join(", "),
        hooks_file = text("/hooks/file"),
        aliases = aliases.join(", "),
    )
}

fn protocol_version(harness: &Value) -> Option<u64> {
    harness.get("protocol").and_then(Value::as_u64)
}
