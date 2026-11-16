use super::{
    block_for,
    scripts::{after, cleanup_script, parse_peek, parse_run, peek_script, run_script, Finished},
};
use crate::cc_connect::remote_project::Seen;
use base64::{engine::general_purpose::STANDARD, Engine};

const PNG: &[u8] = b"\x89PNG\r\n\x1a\nxxxxIEND\xAE\x42\x60\x82";

fn seen(config: Option<&str>) -> Seen {
    Seen { work_dir: Some("/home/me/work".into()), config: config.map(|text| ("1 2".into(), text.into())) }
}

#[test]
fn the_block_is_a_feishu_project_without_secrets_in_the_folder_found_there() {
    let block = block_for(&seen(None), "pc", "codex", "~/work", "2026-11-15").unwrap();
    assert!(block.contains("name = \"pc\"") && block.contains("work_dir = \"/home/me/work\"") && block.contains("type = \"feishu\""));
    assert!(!block.contains("token") && !block.contains("allow_from"));
    let taken = block_for(&seen(Some("[[projects]]\nname = \"pc\"\n")), "pc", "codex", "/w", "x");
    assert_eq!(taken.unwrap_err().code(), "ccConnect.projectTaken");
    assert_eq!(block_for(&Seen { work_dir: None, config: None }, "pc", "codex", "/gone", "x").unwrap_err().code(), "ccConnect.workDir");
    assert_eq!(block_for(&seen(None), "p c", "codex", "/w", "x").unwrap_err().code(), "ccConnect.projectName");
}

#[test]
fn the_run_writes_first_then_scans_and_puts_the_config_back_unless_it_worked() {
    let script = run_script(Some("/opt/cc-connect"), &seen(Some("old")), "pc", "\nblock\n", "20261115-1");
    assert!(script.starts_with("exe='/opt/cc-connect'\n"));
    let write = script.find("grep -qx OK").unwrap();
    let scan = script.find("\"$exe\" feishu new --config \"$c\" --project 'pc' --qr-image \"$d/qr.png\" --set-allow-from-empty >\"$d/out.log\" 2>&1 </dev/null &").unwrap();
    assert!(write < scan);
    assert!(script.contains("d=\"$HOME/.cc-connect/fuyu-feishu-\"'20261115-1'"));
    assert!(script.contains("if [ \"$code\" = 0 ] && grep -q '✅' \"$d/out.log\"; then echo DONE; else put_back; echo UNDONE; fi"));
}

#[test]
fn a_peek_asks_for_the_code_only_until_it_has_one() {
    assert!(peek_script("1", true).contains("printf 'Q %s\\n'"));
    assert!(!peek_script("1", false).contains("printf 'Q %s\\n'"));
    assert!(cleanup_script("1").contains("case $p in ''|*[!0-9]*) ;; *) kill \"$p\" 2>/dev/null ;; esac"));
}

#[test]
fn a_peek_keeps_a_whole_png_and_the_readable_lines() {
    let log = STANDARD.encode("请扫码\n█▀▀█\n\n  URL: https://open.feishu.cn/x \n");
    let peek = parse_peek(&format!("Q {}\nO {log}\n", STANDARD.encode(PNG)));
    assert_eq!(peek.qr, Some(format!("data:image/png;base64,{}", STANDARD.encode(PNG))));
    let lines = peek.output.unwrap();
    assert_eq!(lines, ["请扫码", "URL: https://open.feishu.cn/x"]);
    assert_eq!(after(&lines, "URL:").as_deref(), Some("https://open.feishu.cn/x"));
    let half = parse_peek(&format!("Q {}\n", STANDARD.encode(&PNG[..10])));
    assert!(half.qr.is_none() && half.output.is_none());
}

#[test]
fn the_run_says_done_or_why_not() {
    let log = |text: &str| format!("O {}\n", STANDARD.encode(text));
    let done = parse_run("pc", &format!("OK\nE 0\n{}DONE\n", log("allow_from: ou_1\n✅ created\n")));
    assert_eq!(done, Finished::Done(vec!["allow_from: ou_1".into(), "✅ created".into()]));
    let Finished::Failed(error, _) = parse_run("pc", &format!("OK\nE 1\n{}UNDONE\n", log("Error: onboarding failed: timed out\nTip: x\n"))) else { panic!() };
    assert_eq!(error.to_string(), "The Feishu QR setup did not finish: Error: onboarding failed: timed out");
    let code = |output: &str| match parse_run("pc", output) {
        Finished::Failed(error, _) => error.code(),
        Finished::Done(_) => "done",
    };
    assert_eq!(code("NOTFOUND\n"), "ccConnect.remoteNotFound");
    assert_eq!(code("CHANGED\n"), "ccConnect.remoteChanged");
    assert_eq!(code("FAILED backup\n"), "ccConnect.remoteWrite");
    assert_eq!(code("OK\n"), "ccConnect.feishuUnfinished");
}

#[cfg(unix)]
mod under_sh {
    use super::{block_for, cleanup_script, parse_peek, parse_run, peek_script, run_script, Finished, PNG};
    use crate::cc_connect::remote_project::{parse_read, read_script};
    use std::{
        fs,
        path::{Path, PathBuf},
        process::{Child, Command, Stdio},
        thread,
        time::Duration,
    };

    const FAKE: &str = r#"#!/bin/sh
while [ $# -gt 0 ]; do [ "$1" = --qr-image ] && q=$2; shift; done
printf '\211PNG\r\n\032\nxxxxIEND\256B`\202' > "$q"
echo "URL: https://open.feishu.cn/x"
case $FAKE in
  ok) echo "allow_from: ou_1"; echo "✅ Feishu app created"; exit 0 ;;
  fail) echo "Error: onboarding failed: timed out"; exit 1 ;;
  *) exec sleep 30 ;;
esac
"#;

    struct Remote {
        home: PathBuf,
        fake: String,
    }

    impl Remote {
        fn new(name: &str) -> Self {
            let home = std::env::temp_dir().join(format!("fuyu-cc-remote-feishu-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&home);
            fs::create_dir_all(home.join("work")).unwrap();
            fs::create_dir_all(home.join(".cc-connect")).unwrap();
            let fake = home.join("fake-cc-connect");
            fs::write(&fake, FAKE).unwrap();
            Command::new("chmod").arg("+x").arg(&fake).status().unwrap();
            Self { fake: fake.to_str().unwrap().to_string(), home }
        }

        fn command(&self, script: &str, mode: &str) -> Command {
            let mut command = Command::new("sh");
            command.arg("-c").arg(script).env("HOME", &self.home).env("FAKE", mode).stdout(Stdio::piped());
            command
        }

        fn run(&self, script: &str, mode: &str) -> String {
            String::from_utf8_lossy(&self.command(script, mode).output().unwrap().stdout).into_owned()
        }

        fn config(&self) -> PathBuf {
            self.home.join(".cc-connect").join("config.toml")
        }

        fn scan(&self, name: &str, stamp: &str) -> String {
            let seen = parse_read(&self.run(&read_script("~/work"), ""));
            let block = block_for(&seen, name, "codex", "~/work", "d").unwrap();
            run_script(Some(&self.fake), &seen, name, &block, stamp)
        }

        fn run_dir(&self, stamp: &str) -> PathBuf {
            self.home.join(".cc-connect").join(format!("fuyu-feishu-{stamp}"))
        }
    }

    impl Drop for Remote {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.home);
        }
    }

    fn wait_for(path: &Path) {
        for _ in 0..100 {
            if path.exists() {
                return;
            }
            thread::sleep(Duration::from_millis(50));
        }
        panic!("{} never appeared", path.display());
    }

    #[test]
    fn a_scan_that_works_keeps_the_project_and_cleans_up() {
        let remote = Remote::new("ok");
        fs::write(remote.config(), "# mine\n").unwrap();
        let output = remote.run(&remote.scan("pc", "1"), "ok");
        assert!(matches!(parse_run("pc", &output), Finished::Done(lines) if lines.contains(&"allow_from: ou_1".to_string())));
        assert!(fs::read_to_string(remote.config()).unwrap().contains("name = \"pc\""));
        assert_eq!(fs::read_to_string(remote.home.join(".cc-connect").join("config.toml.bak-fuyu-1")).unwrap(), "# mine\n");
        assert!(!remote.run_dir("1").exists());
    }

    #[test]
    fn a_scan_that_fails_puts_the_old_config_back_or_removes_a_new_one() {
        let remote = Remote::new("fail");
        fs::write(remote.config(), "# mine\n").unwrap();
        let output = remote.run(&remote.scan("pc", "1"), "fail");
        let Finished::Failed(error, _) = parse_run("pc", &output) else { panic!("{output}") };
        assert!(error.to_string().ends_with("Error: onboarding failed: timed out"));
        assert_eq!(fs::read_to_string(remote.config()).unwrap(), "# mine\n");
        fs::remove_file(remote.config()).unwrap();
        remote.run(&remote.scan("pc", "2"), "fail");
        assert!(!remote.config().exists());
        assert!(!remote.run_dir("1").exists() && !remote.run_dir("2").exists());
    }

    #[test]
    fn a_cancel_stops_the_scan_and_the_waiting_run_puts_the_config_back() {
        let remote = Remote::new("cancel");
        fs::write(remote.config(), "# mine\n").unwrap();
        let child: Child = remote.command(&remote.scan("pc", "1"), "hang").spawn().unwrap();
        wait_for(&remote.run_dir("1").join("qr.png"));
        thread::sleep(Duration::from_millis(200));
        let peek = parse_peek(&remote.run(&peek_script("1", true), ""));
        assert_eq!(peek.qr, Some(format!("data:image/png;base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, PNG))));
        assert_eq!(peek.output.unwrap(), ["URL: https://open.feishu.cn/x"]);
        assert!(fs::read_to_string(remote.config()).unwrap().contains("name = \"pc\""));
        remote.run(&cleanup_script("1"), "");
        let output = String::from_utf8_lossy(&child.wait_with_output().unwrap().stdout).into_owned();
        assert!(output.ends_with("UNDONE\n"), "{output}");
        assert_eq!(fs::read_to_string(remote.config()).unwrap(), "# mine\n");
        assert!(!remote.run_dir("1").exists());
        assert_eq!(remote.run(&peek_script("1", true), ""), "");
    }

    #[test]
    fn a_cleanup_after_the_run_was_lost_puts_the_config_back_itself() {
        let remote = Remote::new("lost");
        fs::write(remote.config(), "# mine\n").unwrap();
        fs::write(remote.home.join(".cc-connect").join("config.toml.bak-fuyu-1"), "# mine\n").unwrap();
        fs::write(remote.config(), "# mine\n[[projects]]\nname = \"pc\"\n").unwrap();
        fs::create_dir_all(remote.run_dir("1")).unwrap();
        fs::write(remote.run_dir("1").join("written"), "").unwrap();
        assert_eq!(remote.run(&cleanup_script("1"), ""), "CLEANED\n");
        assert_eq!(fs::read_to_string(remote.config()).unwrap(), "# mine\n");
        assert!(!remote.run_dir("1").exists());
        assert_eq!(remote.run(&cleanup_script("1"), ""), "");
    }
}
