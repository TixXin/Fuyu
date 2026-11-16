mod agents;
mod background;
mod bots;
mod chats;
mod config_file;
#[cfg(windows)]
mod feishu;
mod install;
#[cfg_attr(not(windows), path = "local_unsupported.rs")]
pub(crate) mod local;
#[cfg(windows)]
mod locate;
pub(crate) mod remote;
pub(crate) mod remote_feishu;
mod remote_install;
mod remote_project;
mod remote_run;
#[cfg(windows)]
mod runner;
mod script;

use crate::user_error::UserError;
use std::{
    path::{Path, PathBuf},
    sync::OnceLock,
};

use tauri::{AppHandle, Manager};

static APP_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn init(app: &AppHandle) -> Result<(), String> {
    let dir = crate::home_dir::fuyu_home(app.path()).map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let _ = APP_DIR.set(dir);
    background::init();
    Ok(())
}

fn app_dir() -> Option<&'static Path> {
    APP_DIR.get().map(PathBuf::as_path)
}

const MAX_TEXT_CHARS: usize = 16_000;

#[tauri::command]
pub async fn check_cc_connect_bot(platform: String, token: String) -> Result<bots::BotCheck, UserError> {
    bots::check(&platform, &token).await
}

#[tauri::command]
pub async fn detect_cc_connect_agents(host: Option<String>) -> Result<Vec<agents::FoundAgent>, UserError> {
    match host {
        None => tauri::async_runtime::spawn_blocking(agents::find_local).await.map_err(join_error),
        Some(host) => remote::detect_agents(host).await,
    }
}

fn check_message(project: &str, session_key: &str, text: &str) -> Result<String, UserError> {
    let plain = |value: &str| !value.is_empty() && value.len() <= 256 && !value.chars().any(char::is_control);
    if !plain(project) || !plain(session_key) || !session_key.contains(':') {
        return Err(UserError::new("ccConnect.chat", "The cc-connect project or chat is not valid."));
    }
    if text.trim().is_empty() {
        return Err(UserError::new("ccConnect.emptyPush", "The push has no text."));
    }
    Ok(text.chars().take(MAX_TEXT_CHARS).collect())
}

fn join_error(error: impl std::fmt::Display) -> UserError {
    UserError::new("internal", "Something went wrong inside the island.").detail(error)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::cc_connect::local::get_cc_connect_status,
            crate::cc_connect::local::send_cc_connect_message,
            crate::cc_connect::local::install_cc_connect,
            crate::cc_connect::check_cc_connect_bot,
            crate::cc_connect::detect_cc_connect_agents,
            crate::cc_connect::local::add_cc_connect_project,
            crate::cc_connect::local::get_cc_connect_feishu_setup,
            crate::cc_connect::local::cancel_cc_connect_feishu_setup,
            crate::cc_connect::remote::get_cc_connect_remote_status,
            crate::cc_connect::remote::send_cc_connect_remote_message,
            crate::cc_connect::remote::install_cc_connect_remote,
            crate::cc_connect::remote::add_cc_connect_remote_project,
            crate::cc_connect::remote::restart_cc_connect_remote,
            crate::cc_connect::remote_feishu::start_cc_connect_remote_feishu_setup,
            crate::cc_connect::remote_feishu::get_cc_connect_remote_feishu_setup,
            crate::cc_connect::remote_feishu::cancel_cc_connect_remote_feishu_setup,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
