mod scripts;

use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, MutexGuard, OnceLock, PoisonError,
    },
    thread,
    time::Duration,
};

use serde::Serialize;

use super::{config_file, join_error, remote, remote_project, remote_run};
use crate::agent_status::{remote_fetch::run_ssh, remote_hosts::SshTarget};
use crate::user_error::UserError;
use scripts::Finished;

const PEEK_EVERY: Duration = Duration::from_millis(1500);

#[derive(Serialize, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FeishuProgress {
    running: bool,
    qr: Option<String>,
    url: Option<String>,
    done: bool,
    allow_from: Option<String>,
    error: Option<UserError>,
}

struct Setup {
    id: u64,
    host: String,
    target: SshTarget,
    stamp: String,
    qr: Option<String>,
    output: Vec<String>,
    ended: Option<Result<(), UserError>>,
    done: bool,
}

fn setup() -> MutexGuard<'static, Option<Setup>> {
    static SETUP: OnceLock<Mutex<Option<Setup>>> = OnceLock::new();
    SETUP.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

fn running() -> Result<(), UserError> {
    match setup().as_ref() {
        Some(setup) if setup.ended.is_none() => Err(UserError::new("ccConnect.feishuRunning", "A Feishu QR setup is already running.")),
        _ => Ok(()),
    }
}

#[tauri::command]
pub async fn start_cc_connect_remote_feishu_setup(host: String, path: Option<String>, project: String, agent: String, work_dir: String) -> Result<(), UserError> {
    let target = remote::target(&host, path.as_deref())?;
    running()?;
    tauri::async_runtime::spawn_blocking(move || {
        let output = run_ssh(&target, &remote_project::read_script(work_dir.trim())).map_err(|error| remote::ssh_error(&host, error))?;
        let seen = remote_project::parse_read(&String::from_utf8_lossy(&output));
        let name = project.trim();
        let now = chrono::Local::now();
        let block = block_for(&seen, name, &agent, work_dir.trim(), &now.format("%Y-%m-%d").to_string())?;
        static RUNS: AtomicU64 = AtomicU64::new(1);
        let id = RUNS.fetch_add(1, Ordering::Relaxed);
        let stamp = format!("{}-{id}", now.format("%Y%m%d-%H%M%S"));
        let script = scripts::run_script(path.as_deref(), &seen, name, &block, &stamp);
        let mut current = setup();
        if current.as_ref().is_some_and(|setup| setup.ended.is_none()) {
            return Err(UserError::new("ccConnect.feishuRunning", "A Feishu QR setup is already running."));
        }
        *current = Some(Setup { id, host: host.clone(), target: target.clone(), stamp, qr: None, output: Vec::new(), ended: None, done: false });
        drop(current);
        thread::spawn(move || finish(id, &host, &target, path.as_deref(), run_ssh(&target, &script)));
        thread::spawn(move || peek(id));
        Ok(())
    })
    .await
    .map_err(join_error)?
}

fn block_for(seen: &remote_project::Seen, name: &str, agent: &str, work_dir: &str, today: &str) -> Result<String, UserError> {
    let found = seen.work_dir.as_deref().ok_or_else(|| config_file::work_dir_missing(work_dir))?;
    let project = config_file::NewProject { name, agent, work_dir: found, platform: "feishu", token: "", allow_from: "", proxy: None };
    let taken = seen.config.as_ref().map(|(_, text)| config_file::project_names(text)).unwrap_or_default();
    config_file::check_fields(&project, &taken)?;
    Ok(config_file::project_block(&project, today))
}

fn finish(id: u64, host: &str, target: &SshTarget, path: Option<&str>, result: Result<Vec<u8>, String>) {
    let finished = match result {
        Ok(output) => scripts::parse_run(host, &String::from_utf8_lossy(&output)),
        Err(error) => Finished::Failed(remote::ssh_error(host, error), Vec::new()),
    };
    let (ended, done, output) = match finished {
        Finished::Done(output) => {
            let restarted = run_ssh(target, &remote_run::restart_script(path))
                .map_err(|error| remote::ssh_error(host, error))
                .and_then(|output| remote_run::parse_restart(host, &String::from_utf8_lossy(&output)));
            (restarted, true, output)
        }
        Finished::Failed(error, output) => {
            let stamp = setup().as_ref().filter(|setup| setup.id == id).map(|setup| setup.stamp.clone());
            if let Some(stamp) = stamp {
                let _ = run_ssh(target, &scripts::cleanup_script(&stamp));
            }
            (Err(error), false, output)
        }
    };
    if let Some(setup) = setup().as_mut().filter(|setup| setup.id == id) {
        if !output.is_empty() {
            setup.output = output;
        }
        setup.ended = Some(ended);
        setup.done = done;
    }
}

fn peek(id: u64) {
    loop {
        thread::sleep(PEEK_EVERY);
        let Some((target, stamp, want_qr)) = setup()
            .as_ref()
            .filter(|setup| setup.id == id && setup.ended.is_none())
            .map(|setup| (setup.target.clone(), setup.stamp.clone(), setup.qr.is_none()))
        else {
            return;
        };
        let Ok(output) = run_ssh(&target, &scripts::peek_script(&stamp, want_qr)) else { continue };
        let seen = scripts::parse_peek(&String::from_utf8_lossy(&output));
        if let Some(setup) = setup().as_mut().filter(|setup| setup.id == id && setup.ended.is_none()) {
            if seen.qr.is_some() {
                setup.qr = seen.qr;
            }
            if let Some(output) = seen.output {
                setup.output = output;
            }
        }
    }
}

fn progress() -> FeishuProgress {
    let current = setup();
    let Some(setup) = current.as_ref() else { return FeishuProgress::default() };
    let running = setup.ended.is_none();
    FeishuProgress {
        running,
        qr: setup.qr.clone().filter(|_| running),
        url: scripts::after(&setup.output, "URL:"),
        done: setup.done,
        allow_from: scripts::after(&setup.output, "allow_from:"),
        error: setup.ended.as_ref().and_then(|ended| ended.as_ref().err().cloned()),
    }
}

#[tauri::command]
pub async fn get_cc_connect_remote_feishu_setup() -> Result<FeishuProgress, UserError> {
    Ok(progress())
}

#[tauri::command]
pub async fn cancel_cc_connect_remote_feishu_setup() -> Result<(), UserError> {
    let Some(setup) = setup().take() else { return Ok(()) };
    if setup.ended.is_some() {
        return Ok(());
    }
    tauri::async_runtime::spawn_blocking(move || {
        run_ssh(&setup.target, &scripts::cleanup_script(&setup.stamp)).map(drop).map_err(|error| remote::ssh_error(&setup.host, error))
    })
    .await
    .map_err(join_error)?
}

#[cfg(test)]
mod tests;
