use crate::user_error::UserError;
use crate::system::CommandExt;
use std::{
    fs,
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, MutexGuard, OnceLock, PoisonError},
    thread,
    time::Duration,
};

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

use super::{config_file, locate::FOLDER};
use crate::{
    system::CREATE_NO_WINDOW,
    win32::job::{self, Job},
};

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
    child: Child,
    _job: Job,
    output: Arc<Mutex<Vec<String>>>,
    qr: PathBuf,
    config: PathBuf,
    original: Option<String>,
    ended: Option<Result<(), UserError>>,
}

fn setup() -> MutexGuard<'static, Option<Setup>> {
    static SETUP: OnceLock<Mutex<Option<Setup>>> = OnceLock::new();
    SETUP.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) fn start(exe: &Path, config: &Path, project: &config_file::NewProject, app_dir: &Path, today: &str, stamp: &str) -> Result<(), UserError> {
    let mut current = setup();
    if current.as_ref().is_some_and(|setup| setup.ended.is_none()) {
        return Err(UserError::new("ccConnect.feishuRunning", "A Feishu QR setup is already running."));
    }
    let original = config_file::add_project(config, project, today, stamp)?;
    let qr = app_dir.join(FOLDER).join("feishu-qr.png");
    let _ = fs::remove_file(&qr);
    let started = spawn(exe, config, project.name, &qr);
    let (mut child, job) = match started {
        Ok(started) => started,
        Err(error) => {
            let _ = config_file::restore(config, original.as_deref());
            return Err(error);
        }
    };
    let output = Arc::new(Mutex::new(Vec::new()));
    for pipe in [child.stdout.take().map(|pipe| Box::new(pipe) as Box<dyn Read + Send>), child.stderr.take().map(|pipe| Box::new(pipe) as _)]
        .into_iter()
        .flatten()
    {
        let output = Arc::clone(&output);
        thread::spawn(move || {
            for line in BufReader::new(pipe).lines().map_while(Result::ok) {
                if let Some(line) = worth_keeping(&line) {
                    output.lock().unwrap_or_else(PoisonError::into_inner).push(line);
                }
            }
        });
    }
    *current = Some(Setup { child, _job: job, output, qr, config: config.to_path_buf(), original, ended: None });
    thread::spawn(|| loop {
        thread::sleep(Duration::from_secs(1));
        match setup().as_mut() {
            Some(setup) if setup.ended.is_none() => settle(setup),
            _ => return,
        }
    });
    Ok(())
}

fn spawn(exe: &Path, config: &Path, project: &str, qr: &Path) -> Result<(Child, Job), UserError> {
    if let Some(dir) = qr.parent() {
        fs::create_dir_all(dir).map_err(|error| UserError::new("file.create", format!("Could not create {}.", dir.display())).arg("path", dir.display().to_string()).detail(error))?;
    }
    let mut child = Command::new(exe)
        .args(["feishu", "new", "--config"])
        .arg(config)
        .args(["--project", project, "--qr-image"])
        .arg(qr)
        .arg("--set-allow-from-empty")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW | job::START_SUSPENDED)
        .spawn()
        .map_err(|error| UserError::new("ccConnect.run", "Could not run cc-connect.").detail(error))?;
    match Job::new().and_then(|job| job.assign(&child).map(|()| job)).and_then(|job| job::resume(child.id()).map(|()| job)) {
        Ok(job) => Ok((child, job)),
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            Err(UserError::new("ccConnect.run", "Could not run cc-connect.").detail(error))
        }
    }
}

fn worth_keeping(line: &str) -> Option<String> {
    let line = line.trim();
    let drawn = line.chars().any(|ch| matches!(ch, '█' | '▀' | '▄'));
    (!line.is_empty() && !drawn).then(|| line.to_string())
}

fn settle(setup: &mut Setup) {
    let Ok(Some(exit)) = setup.child.try_wait() else { return };
    thread::sleep(Duration::from_millis(150));
    let output = setup.output.lock().unwrap_or_else(PoisonError::into_inner).clone();
    let succeeded = exit.success() && output.iter().any(|line| line.starts_with('✅'));
    setup.ended = Some(if succeeded { Ok(()) } else { Err(failure(&output)) });
    if succeeded {
        super::runner::restart();
    } else {
        let _ = config_file::restore(&setup.config, setup.original.as_deref());
    }
    let _ = fs::remove_file(&setup.qr);
}

pub(super) fn progress() -> FeishuProgress {
    let mut current = setup();
    let Some(setup) = current.as_mut() else { return FeishuProgress::default() };
    if setup.ended.is_none() {
        settle(setup);
    }
    let output = setup.output.lock().unwrap_or_else(PoisonError::into_inner);
    let after = |prefix: &str| output.iter().rev().find_map(|line| line.strip_prefix(prefix)).map(|rest| rest.trim().to_string());
    let running = setup.ended.is_none();
    FeishuProgress {
        running,
        qr: running.then(|| fs::read(&setup.qr).ok()).flatten().map(|png| format!("data:image/png;base64,{}", STANDARD.encode(png))),
        url: after("URL:"),
        done: matches!(setup.ended, Some(Ok(()))),
        allow_from: after("allow_from:"),
        error: setup.ended.as_ref().and_then(|ended| ended.as_ref().err().cloned()),
    }
}

fn failure(output: &[String]) -> UserError {
    let line = output.iter().rev().find(|line| line.starts_with("Error")).or(output.last());
    UserError::new("ccConnect.feishuUnfinished", "The Feishu QR setup did not finish.").detail(line.map_or("", String::as_str))
}

pub(super) fn cancel() {
    let Some(mut setup) = setup().take() else { return };
    if setup.ended.is_none() {
        settle(&mut setup);
    }
    if setup.ended.is_none() {
        let _ = setup.child.kill();
        let _ = setup.child.wait();
        let _ = config_file::restore(&setup.config, setup.original.as_deref());
    }
    let _ = fs::remove_file(&setup.qr);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_cancel_keeps_an_app_already_made_and_otherwise_puts_the_old_config_back() {
        let dir = std::env::temp_dir().join(format!("focusd-cc-connect-feishu-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let config = dir.join("config.toml");
        let begin = |program: &str, args: &[&str], said: &[&str]| {
            fs::write(&config, "with the app").unwrap();
            let child = Command::new(program).args(args).stdout(Stdio::null()).creation_flags(CREATE_NO_WINDOW).spawn().unwrap();
            let output = Arc::new(Mutex::new(said.iter().map(|line| line.to_string()).collect()));
            let qr = dir.join("qr.png");
            *setup() = Some(Setup { child, _job: Job::new().unwrap(), output, qr, config: config.clone(), original: Some("before".into()), ended: None });
        };

        begin("cmd", &["/c", "exit 0"], &["✅ Feishu app created"]);
        setup().as_mut().unwrap().child.wait().unwrap();
        cancel();
        assert_eq!(fs::read_to_string(&config).unwrap(), "with the app");

        begin("ping", &["-n", "30", "127.0.0.1"], &["URL: https://open.feishu.cn/x"]);
        cancel();
        assert_eq!(fs::read_to_string(&config).unwrap(), "before");
        assert!(setup().is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_drawn_qr_code_and_blank_lines_are_left_out() {
        assert_eq!(worth_keeping("  URL: https://open.feishu.cn/x "), Some("URL: https://open.feishu.cn/x".into()));
        assert_eq!(worth_keeping("█▀▀▀▀▀█ ▄▄ █▀▀▀▀▀█"), None);
        assert_eq!(worth_keeping("   "), None);
    }

    #[test]
    fn a_failure_says_cc_connect_s_error() {
        let output = ["请扫码".to_string(), "Error: onboarding failed: timed out".into(), "Tip: bind instead".into()];
        assert_eq!(failure(&output).to_string(), "The Feishu QR setup did not finish: Error: onboarding failed: timed out");
        assert_eq!(failure(&output[..1]).to_string(), "The Feishu QR setup did not finish: 请扫码");
        assert_eq!(failure(&[]).to_string(), "The Feishu QR setup did not finish.");
    }
}
