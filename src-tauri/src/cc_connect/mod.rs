mod bots;
mod chats;
mod config_file;
mod feishu;
mod install;
mod locate;
pub(crate) mod remote;
mod runner;

use crate::user_error::UserError;
use std::{
    io::{Read, Write},
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::OnceLock,
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::system::{windows_home_dir, CREATE_NO_WINDOW};

static APP_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn init(app: &AppHandle) -> Result<(), String> {
    let dir = crate::home_dir::fuyu_home(app.path()).map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let _ = APP_DIR.set(dir);
    Ok(())
}

fn app_dir() -> Option<&'static Path> {
    APP_DIR.get().map(PathBuf::as_path)
}

const SEND_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_TEXT_CHARS: usize = 16_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcConnectStatus {
    exe: Option<String>,
    exe_source: Option<&'static str>,
    exe_error: Option<UserError>,
    running: bool,
    runner: &'static str,
    runner_error: Option<UserError>,
    data_dir: String,
    default_work_dir: Option<String>,
    config: bool,
    config_projects: Vec<String>,
    projects: Vec<chats::Project>,
}

fn default_work_dir() -> Option<PathBuf> {
    app_dir().map(|dir| dir.join("cc-connect").join("work"))
}

fn data_dir() -> Result<PathBuf, String> {
    windows_home_dir().map(|home| home.join(".cc-connect"))
}

pub(crate) fn apply(settings: &serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    runner::apply(settings, app_dir(), config_file::config_path(&data_dir()?)).map_err(|error| error.to_string())
}

pub(crate) fn stop() {
    runner::stop();
    feishu::cancel();
}

#[tauri::command]
pub async fn get_cc_connect_status(path: Option<String>) -> Result<CcConnectStatus, UserError> {
    let data_dir = data_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        let (found, exe_error) = match locate::find(path.as_deref(), app_dir()) {
            Ok(found) => (found, None),
            Err(error) => (None, Some(error)),
        };
        let run = runner::state();
        let config = std::fs::read_to_string(config_file::config_path(&data_dir)).ok();
        CcConnectStatus {
            exe: found.as_ref().map(|(exe, _)| exe.display().to_string()),
            exe_source: found.map(|(_, source)| source),
            exe_error,
            running: crate::win32::process::running_executable(&[locate::EXE_NAME]).is_some(),
            runner: run.key(),
            runner_error: run.error(),
            projects: chats::read_projects(&data_dir, config.as_deref()),
            config_projects: config.as_deref().map(config_file::project_names).unwrap_or_default(),
            config: config.is_some(),
            data_dir: data_dir.display().to_string(),
            default_work_dir: default_work_dir().map(|dir| dir.display().to_string()),
        }
    })
    .await
    .map_err(join_error)
}

#[tauri::command]
pub async fn send_cc_connect_message(path: Option<String>, project: String, session_key: String, text: String) -> Result<(), UserError> {
    let text = check_message(&project, &session_key, &text)?;
    tauri::async_runtime::spawn_blocking(move || {
        let (exe, _) = locate::find(path.as_deref(), app_dir())?.ok_or_else(|| UserError::new("ccConnect.notFound", "cc-connect was not found; fill in its path in the plugin's settings."))?;
        send(&exe, &project, &session_key, &text)
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
pub async fn install_cc_connect() -> Result<String, UserError> {
    let app_dir = app_dir().ok_or_else(|| UserError::new("ccConnect.notReady", "cc-connect is not ready yet."))?.to_path_buf();
    install::install(app_dir).await.map(|exe| exe.display().to_string())
}

#[tauri::command]
pub async fn check_cc_connect_bot(platform: String, token: String) -> Result<bots::BotCheck, UserError> {
    bots::check(&platform, &token).await
}

#[tauri::command]
pub async fn add_cc_connect_project(
    path: Option<String>,
    project: String,
    agent: String,
    work_dir: String,
    platform: String,
    token: String,
    allow_from: String,
) -> Result<(), UserError> {
    let config = config_file::config_path(&data_dir()?);
    let app_dir = app_dir().ok_or_else(|| UserError::new("ccConnect.notReady", "cc-connect is not ready yet."))?.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(default) = default_work_dir().filter(|dir| Path::new(work_dir.trim()) == dir) {
            std::fs::create_dir_all(&default).map_err(|error| UserError::new("ccConnect.workDirCreate", format!("The work folder could not be made: {}", default.display())).arg("path", default.display().to_string()).detail(error))?;
        }
        let proxy = crate::system::updater::get_updater_proxy();
        let new = config_file::NewProject {
            name: project.trim(),
            agent: &agent,
            work_dir: work_dir.trim(),
            platform: &platform,
            token: token.trim(),
            allow_from: allow_from.trim(),
            proxy: proxy.as_deref(),
        };
        let now = chrono::Local::now();
        let (today, stamp) = (now.format("%Y-%m-%d").to_string(), now.format("%Y%m%d-%H%M%S").to_string());
        if platform == "feishu" {
            let (exe, _) = locate::find(path.as_deref(), Some(&app_dir))?.ok_or_else(|| UserError::new("ccConnect.notDownloaded", "cc-connect was not found; download it first."))?;
            return feishu::start(&exe, &config, &new, &app_dir, &today, &stamp);
        }
        config_file::add_project(&config, &new, &today, &stamp)?;
        runner::restart();
        Ok(())
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
pub async fn get_cc_connect_feishu_setup() -> Result<feishu::FeishuProgress, UserError> {
    tauri::async_runtime::spawn_blocking(feishu::progress)
        .await
        .map_err(join_error)
}

#[tauri::command]
pub async fn cancel_cc_connect_feishu_setup() -> Result<(), UserError> {
    tauri::async_runtime::spawn_blocking(feishu::cancel)
        .await
        .map_err(join_error)
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

fn send(exe: &Path, project: &str, session_key: &str, text: &str) -> Result<(), UserError> {
    let mut child = Command::new(exe)
        .args(["send", "-p", project, "-s", session_key, "--stdin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|error| UserError::new("ccConnect.run", "Could not run cc-connect.").detail(error))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(text.as_bytes()).map_err(|error| UserError::new("ccConnect.stdin", "Could not hand the text to cc-connect.").detail(error))?;
    }
    let deadline = Instant::now() + SEND_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(50)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(UserError::new("ccConnect.timeout", "cc-connect did not answer within 10 seconds."));
            }
            Err(error) => return Err(UserError::new("ccConnect.failed", "cc-connect failed.").detail(error)),
        }
    };
    if status.success() {
        return Ok(());
    }
    let mut stderr = String::new();
    if let Some(mut pipe) = child.stderr.take() {
        let _ = pipe.read_to_string(&mut stderr);
    }
    let reason = stderr.lines().map(str::trim).find(|line| !line.is_empty()).map(str::to_string);
    Err(UserError::new("ccConnect.failed", "cc-connect failed.").detail(reason.unwrap_or_else(|| format!("exit code {}", status.code().unwrap_or(-1)))))
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::cc_connect::get_cc_connect_status,
            crate::cc_connect::send_cc_connect_message,
            crate::cc_connect::install_cc_connect,
            crate::cc_connect::check_cc_connect_bot,
            crate::cc_connect::add_cc_connect_project,
            crate::cc_connect::get_cc_connect_feishu_setup,
            crate::cc_connect::cancel_cc_connect_feishu_setup,
            crate::cc_connect::remote::get_cc_connect_remote_status,
            crate::cc_connect::remote::send_cc_connect_remote_message,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
