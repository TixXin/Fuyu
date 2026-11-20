use std::{ffi::OsString, process::Command};

use crate::system::CommandExt;

#[cfg_attr(not(windows), allow(dead_code))]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

struct Program {
    path: &'static str,
    args: Vec<OsString>,
    flags: u32,
}

#[cfg_attr(not(windows), allow(dead_code))]
const fn program(path: &'static str) -> Program {
    Program { path, args: Vec::new(), flags: 0 }
}

fn with_args(path: &'static str, args: &[&str]) -> Program {
    Program { path, args: args.iter().map(OsString::from).collect(), flags: 0 }
}

#[cfg(windows)]
fn programs(target: &str) -> Option<Vec<Program>> {
    Some(match target {
        "files" => vec![program("explorer.exe")],
        "terminal" => vec![program("wt.exe"), Program { flags: CREATE_NEW_CONSOLE, ..program("cmd.exe") }],
        "calculator" => vec![program("calc.exe")],
        "settings" => vec![with_args("explorer.exe", &["ms-settings:"])],
        _ => return None,
    })
}

#[cfg(target_os = "macos")]
fn programs(target: &str) -> Option<Vec<Program>> {
    let home = std::env::var_os("HOME").unwrap_or_else(|| OsString::from("/"));
    Some(match target {
        "files" => vec![Program { path: "open", args: vec![home], flags: 0 }],
        "terminal" => vec![with_args("open", &["-a", "Terminal"])],
        "calculator" => vec![with_args("open", &["-a", "Calculator"])],
        "settings" => vec![with_args("open", &["-b", "com.apple.systempreferences"])],
        _ => return None,
    })
}

pub(crate) fn is_target(target: &str) -> bool {
    programs(target).is_some()
}

pub(crate) fn launch(target: &str) -> Result<(), String> {
    let mut last = String::from("no program");
    for candidate in programs(target).unwrap_or_default() {
        match Command::new(candidate.path).args(&candidate.args).creation_flags(candidate.flags).spawn() {
            Ok(mut child) => {
                std::thread::spawn(move || {
                    let _ = child.wait();
                });
                return Ok(());
            }
            Err(error) => last = format!("{}: {error}", candidate.path),
        }
    }
    Err(last)
}

#[cfg(test)]
mod tests {
    use super::is_target;

    #[test]
    fn only_the_four_quick_targets_are_known() {
        for target in ["files", "terminal", "calculator", "settings"] {
            assert!(is_target(target), "{target}");
        }
        assert!(!is_target("rm"));
        assert!(!is_target(""));
    }
}
