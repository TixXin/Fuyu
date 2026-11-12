use std::{
    collections::HashMap,
    io::{BufRead, BufReader},
    os::windows::process::CommandExt,
    process::{Command, Stdio},
    sync::{mpsc, Mutex, PoisonError},
    thread,
    time::Duration,
};

use crate::{system::CREATE_NO_WINDOW, win32::job::Job};

const START_TIMEOUT: Duration = Duration::from_secs(15);
const SETTLE: Duration = Duration::from_secs(2);

#[derive(Clone, Copy, PartialEq, Eq)]
enum Measurement {
    Running,
    Done(Option<u64>),
}

static MEASUREMENTS: Mutex<Option<HashMap<&'static str, Measurement>>> = Mutex::new(None);

fn runtime_for(image: &str) -> Option<&'static str> {
    if image.eq_ignore_ascii_case("powershell.exe") {
        Some("powershell.exe")
    } else if image.eq_ignore_ascii_case("node.exe") {
        Some("node.exe")
    } else {
        None
    }
}

pub(super) fn runtime_bytes(image: &str) -> Option<u64> {
    let runtime = runtime_for(image)?;
    let mut measurements = MEASUREMENTS.lock().unwrap_or_else(PoisonError::into_inner);
    let table = measurements.get_or_insert_with(HashMap::new);
    match table.get(runtime) {
        Some(Measurement::Done(bytes)) => *bytes,
        Some(Measurement::Running) => None,
        None => {
            table.insert(runtime, Measurement::Running);
            let started = thread::Builder::new()
                .name("plugin-runtime-baseline".into())
                .spawn(move || {
                    let bytes = measure(runtime);
                    let mut measurements = MEASUREMENTS.lock().unwrap_or_else(PoisonError::into_inner);
                    measurements.get_or_insert_with(HashMap::new).insert(runtime, Measurement::Done(bytes));
                });
            if started.is_err() {
                table.insert(runtime, Measurement::Done(None));
            }
            None
        }
    }
}

fn idle_command(runtime: &str) -> Command {
    let mut command = if runtime == "node.exe" {
        let mut command = Command::new("node");
        command.args(["-e", "console.log('ready'); setTimeout(() => {}, 60000)"]);
        command
    } else {
        let mut command = Command::new("powershell.exe");
        command.args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "[Console]::Out.WriteLine('ready'); Start-Sleep -Seconds 60",
        ]);
        command
    };
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW);
    command
}

fn measure(runtime: &str) -> Option<u64> {
    let job = Job::new().ok()?;
    let mut child = idle_command(runtime).spawn().ok()?;
    if job.assign(&child).is_err() {
        let _ = child.kill();
        return None;
    }
    let stdout = child.stdout.take()?;
    let (ready, started) = mpsc::channel();
    let _ = thread::Builder::new().name("plugin-runtime-baseline-read".into()).spawn(move || {
        let mut line = String::new();
        let _ = BufReader::new(stdout).read_line(&mut line);
        let _ = ready.send(line.trim() == "ready");
    });
    let bytes = match started.recv_timeout(START_TIMEOUT) {
        Ok(true) => {
            thread::sleep(SETTLE);
            job.usage().map(|usage| usage.memory_bytes).filter(|bytes| *bytes > 0)
        }
        _ => None,
    };
    drop(job);
    let _ = child.wait();
    bytes
}

#[cfg(test)]
mod tests {
    use super::{measure, runtime_for};

    #[test]
    fn only_script_runtimes_have_a_baseline() {
        assert_eq!(runtime_for("PowerShell.EXE"), Some("powershell.exe"));
        assert_eq!(runtime_for("node.exe"), Some("node.exe"));
        assert_eq!(runtime_for("my-plugin.exe"), None);
        assert_eq!(runtime_for(""), None);
    }

    #[test]
    fn an_idle_powershell_takes_tens_of_megabytes() {
        let bytes = measure("powershell.exe").expect("measured");
        assert!((10 * 1024 * 1024..400 * 1024 * 1024).contains(&bytes), "{bytes}");
    }
}
