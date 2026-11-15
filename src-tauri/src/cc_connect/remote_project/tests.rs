use super::{block_for, parse_read, parse_write, read_script, write_script, Seen};
use crate::cc_connect::config_file::NewProject;
use base64::{engine::general_purpose::STANDARD, Engine};

fn telegram<'a>(name: &'a str, work_dir: &'a str) -> NewProject<'a> {
    NewProject { name, agent: "codex", work_dir, platform: "telegram", token: "123:SECRET'$(x)", allow_from: "42", proxy: Some("http://127.0.0.1:7897") }
}

fn seen(config: Option<&str>) -> Seen {
    Seen { work_dir: Some("/home/me/work".into()), config: config.map(|text| ("123 45".into(), text.into())) }
}

#[test]
fn the_read_expands_the_home_and_sends_the_config_back_as_base64() {
    let script = read_script("~/work");
    assert!(script.starts_with("w='~/work'\ncase $w in \"~\") w=\"$HOME\""));
    assert!(script.contains("printf 'C %s\\n' \"$(base64 < \"$c\" | tr -d '\\n')\""));
    let text = "[[projects]]\nname = \"a\"\n";
    let read = parse_read(&format!("W /home/me/work\nK 3 4\nC {}\n", STANDARD.encode(text)));
    assert_eq!(read.work_dir.as_deref(), Some("/home/me/work"));
    assert_eq!(read.config, Some(("3 4".into(), text.into())));
    let empty = parse_read("");
    assert!(empty.work_dir.is_none() && empty.config.is_none());
}

#[test]
fn the_block_uses_the_folder_found_there_and_no_local_proxy() {
    let block = block_for(&seen(None), &telegram("pc-codex", "~/work"), "2026-11-15").unwrap();
    assert!(block.contains("work_dir = \"/home/me/work\""));
    assert!(block.contains("type = \"codex\"") && !block.contains("proxy"));
    let taken = block_for(&seen(Some("[[projects]]\nname = \"pc-codex\"\n")), &telegram("pc-codex", "~/work"), "x");
    assert_eq!(taken.unwrap_err().code(), "ccConnect.projectTaken");
    let nowhere = Seen { work_dir: None, config: None };
    assert_eq!(block_for(&nowhere, &telegram("pc", "/gone"), "x").unwrap_err().code(), "ccConnect.workDir");
    let feishu = NewProject { platform: "feishu", ..telegram("pc", "/w") };
    assert_eq!(block_for(&seen(None), &feishu, "x").unwrap_err().code(), "ccConnect.remoteFeishu");
}

#[test]
fn the_token_travels_inside_base64_and_never_as_shell_text() {
    let block = block_for(&seen(None), &telegram("pc", "/w"), "2026-11-15").unwrap();
    let script = write_script(&seen(Some("old")), "pc", &block, "20261115-120000");
    assert!(!script.contains("SECRET"));
    assert!(script.contains(&format!("printf '%s' '{}' | base64 -d", STANDARD.encode(&block))));
    assert!(script.contains("grep -qxF 'name = \"pc\"' \"$c.fuyu.tmp\" || undo check"));
}

#[test]
fn it_writes_only_over_the_config_it_read_and_backs_it_up_first() {
    let script = write_script(&seen(Some("old")), "pc", "\nblock\n", "20261115-120000");
    assert!(script.starts_with("c=\"$HOME/.cc-connect/config.toml\"\nb=\"$c.bak-fuyu-\"'20261115-120000'\n"));
    assert!(script.contains("[ \"$now\" = '123 45' ] || { echo CHANGED; exit 0; }"));
    let backup = script.find("cp -p \"$c\" \"$b\"").unwrap();
    assert!(backup < script.find("> \"$c.fuyu.tmp\"").unwrap());
    let fresh = write_script(&seen(None), "pc", "\nblock\n", "1");
    assert!(fresh.contains("[ \"$now\" = '' ] || { echo CHANGED; exit 0; }"));
}

#[test]
fn a_failure_puts_the_backup_back_or_removes_a_config_that_was_not_there() {
    let script = write_script(&seen(Some("old")), "pc", "\nblock\n", "1");
    assert!(script.contains("if [ -f \"$c\" ]; then cp -p \"$c\" \"$b\" || { echo 'FAILED backup'; exit 0; }; else b=; fi"));
    assert!(script.contains("undo() {\n  if [ -n \"$b\" ]; then cp -p \"$b\" \"$c\"; else rm -f \"$c\"; fi\n  rm -f \"$c.fuyu.tmp\""));
    assert!(script.contains("mv -f \"$c.fuyu.tmp\" \"$c\" || undo move"));
}

#[test]
fn the_answer_says_done_changed_or_which_step_failed() {
    assert!(parse_write("pc", "B /home/me/.cc-connect/config.toml.bak-fuyu-1\nOK\n").is_ok());
    assert_eq!(parse_write("pc", "CHANGED\n").unwrap_err().code(), "ccConnect.remoteChanged");
    assert_eq!(parse_write("pc", "FAILED check\n").unwrap_err().code(), "ccConnect.remoteWrite");
    assert_eq!(parse_write("pc", "").unwrap_err().code(), "ccConnect.remoteWrite");
}

#[cfg(unix)]
#[test]
fn the_scripts_run_under_sh_backing_up_and_restoring() {
    use std::{fs, process::Command};
    let home = std::env::temp_dir().join(format!("fuyu-cc-remote-project-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(home.join("work")).unwrap();
    let run = |script: &str| {
        let output = Command::new("sh").arg("-c").arg(script).env("HOME", &home).output().unwrap();
        String::from_utf8_lossy(&output.stdout).into_owned()
    };
    let first = parse_read(&run(&read_script("~/work")));
    assert_eq!(first.work_dir.as_deref(), Some(home.join("work").to_str().unwrap()));
    let block = block_for(&first, &telegram("a", "~/work"), "d").unwrap();
    parse_write("pc", &run(&write_script(&first, "a", &block, "1"))).unwrap();
    let config = home.join(".cc-connect").join("config.toml");
    let after_first = fs::read_to_string(&config).unwrap();
    assert!(after_first.starts_with("# cc-connect configuration") && after_first.contains("name = \"a\""));

    let second = parse_read(&run(&read_script("~/work")));
    let block = block_for(&second, &telegram("b", "~/work"), "d").unwrap();
    assert_eq!(parse_write("pc", &run(&write_script(&first, "b", &block, "2"))).unwrap_err().code(), "ccConnect.remoteChanged");
    parse_write("pc", &run(&write_script(&second, "b", &block, "2"))).unwrap();
    assert_eq!(fs::read_to_string(home.join(".cc-connect").join("config.toml.bak-fuyu-2")).unwrap(), after_first);
    assert!(fs::read_to_string(&config).unwrap().contains("name = \"b\""));

    let third = parse_read(&run(&read_script("~/work")));
    let before = fs::read_to_string(&config).unwrap();
    let broken = write_script(&third, "c", "\nno project here\n", "3");
    assert_eq!(parse_write("pc", &run(&broken)).unwrap_err().code(), "ccConnect.remoteWrite");
    assert_eq!(fs::read_to_string(&config).unwrap(), before);
    assert!(!home.join(".cc-connect").join("config.toml.fuyu.tmp").exists());

    fs::remove_file(&config).unwrap();
    let none = parse_read(&run(&read_script("~/work")));
    assert_eq!(parse_write("pc", &run(&write_script(&none, "c", "\nnot it\n", "4"))).unwrap_err().code(), "ccConnect.remoteWrite");
    assert!(!config.exists());
    let _ = fs::remove_dir_all(&home);
}
