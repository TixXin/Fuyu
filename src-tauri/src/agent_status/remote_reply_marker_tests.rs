use super::*;
use super::super::super::reply_marker::block;

fn file(target: &str, text: &str) -> Found {
    Found::File { target: target.into(), text: text.into() }
}

#[test]
fn the_listing_carries_each_file_whole_and_says_what_is_broken() {
    let bytes = b"H\t/home/u\nF\t/home/u/.claude/CLAUDE.md\t6\na\tb\nc\nF\t/home/u/.codex/AGENTS.md\t0\nB\t/home/u/.dsh/AGENTS.md\t/gone\nR\t/home/u/.claude/rules/fuyu-reply-marker.md\n";
    assert_eq!(
        parse(bytes).unwrap(),
        vec![
            Found::Home("/home/u".into()),
            file("/home/u/.claude/CLAUDE.md", "a\tb\nc\n"),
            file("/home/u/.codex/AGENTS.md", ""),
            Found::Broken { path: "/home/u/.dsh/AGENTS.md".into(), link: "/gone".into() },
            Found::OldRules("/home/u/.claude/rules/fuyu-reply-marker.md".into()),
        ]
    );
    assert!(parse(b"F\t/x\t9\nshort").is_err());
    assert!(parse(b"what\n").is_err());
    assert_eq!(shown("/home/u/.dsh/AGENTS.md is a link", Some("/home/u")), "~/.dsh/AGENTS.md is a link");
    assert_eq!(shown("/home/user2/x", Some("/home/u")), "/home/user2/x");
}

#[test]
fn every_target_gets_one_block_once_and_the_old_rules_go() {
    let found = vec![
        file("/s/CLAUDE.md", "# mine\n"),
        file("/s/CLAUDE.md", "# mine\n"),
        file("/h/.codex/AGENTS.md", ""),
        Found::Broken { path: "/h/.dsh/AGENTS.md".into(), link: "/gone".into() },
        Found::OldRules("/h/.claude/rules/fuyu-reply-marker.md".into()),
    ];
    let enabled = plan(&found, Change::Enable);
    assert_eq!(enabled.writes.len(), 2);
    assert_eq!(enabled.writes[0], ("/s/CLAUDE.md".to_string(), format!("# mine\n\n{}\n", block())));
    assert_eq!(enabled.remove, vec!["/h/.claude/rules/fuyu-reply-marker.md".to_string()]);
    assert_eq!(enabled.errors, vec!["/h/.dsh/AGENTS.md is a link to /gone, which does not exist".to_string()]);

    let on = vec![file("/s/CLAUDE.md", &enabled.writes[0].1), file("/h/.codex/AGENTS.md", &enabled.writes[1].1)];
    assert!(plan(&on, Change::Enable).writes.is_empty());
    let off = plan(&on, Change::Disable);
    assert_eq!(off.writes, vec![("/s/CLAUDE.md".to_string(), "# mine\n".to_string()), ("/h/.codex/AGENTS.md".to_string(), String::new())]);
}

#[test]
fn repair_only_touches_hosts_that_already_have_the_marker() {
    let untouched = vec![file("/h/.claude/CLAUDE.md", "# mine\n"), file("/h/.codex/AGENTS.md", "")];
    assert_eq!(plan(&untouched, Change::Repair), Plan::default());
    let mut old = untouched.clone();
    old.push(Found::OldRules("/h/.claude/rules/fuyu-reply-marker.md".into()));
    let repaired = plan(&old, Change::Repair);
    assert_eq!(repaired.writes.len(), 2);
    assert_eq!(repaired.remove.len(), 1);
    let half = vec![file("/h/.claude/CLAUDE.md", &format!("{}\n", block())), file("/h/.codex/AGENTS.md", "")];
    assert_eq!(plan(&half, Change::Repair).writes, vec![("/h/.codex/AGENTS.md".to_string(), format!("{}\n", block()))]);
}

#[cfg(unix)]
#[test]
fn the_listing_script_follows_links_and_skips_what_is_not_there() {
    use std::os::unix::fs::symlink;
    let home = std::env::temp_dir().join(format!("fuyu-remote-marker-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&home);
    let home = {
        std::fs::create_dir_all(&home).unwrap();
        std::fs::canonicalize(&home).unwrap()
    };
    let at = |path: &str| home.join(path);
    std::fs::create_dir_all(at("store")).unwrap();
    std::fs::create_dir_all(at(".claude/rules")).unwrap();
    std::fs::create_dir_all(at(".codex")).unwrap();
    std::fs::create_dir_all(at(".dsh")).unwrap();
    std::fs::write(at("store/CLAUDE.md"), "# mine\n").unwrap();
    symlink(at("store/CLAUDE.md"), at(".claude/CLAUDE.md")).unwrap();
    symlink(at("store/missing.md"), at(".dsh/AGENTS.md")).unwrap();
    std::fs::write(at(".claude/rules/fuyu-reply-marker.md"), format!("{}\n", block())).unwrap();
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(list_script())
        .env("HOME", &home)
        .env_remove("CLAUDE_CONFIG_DIR")
        .env_remove("CODEX_HOME")
        .env_remove("DSH_HOME")
        .output()
        .unwrap();
    let found = parse(&output.stdout).unwrap();
    let shown = |path: &str| home.join(path).display().to_string();
    assert_eq!(
        found,
        vec![
            Found::Home(home.display().to_string()),
            file(&shown("store/CLAUDE.md"), "# mine\n"),
            file(&shown(".codex/AGENTS.md"), ""),
            Found::Broken { path: shown(".dsh/AGENTS.md"), link: shown("store/missing.md") },
            Found::OldRules(shown(".claude/rules/fuyu-reply-marker.md")),
        ]
    );
    let _ = std::fs::remove_dir_all(&home);
}
