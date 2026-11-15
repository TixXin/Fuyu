use super::*;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-reply-marker-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn blocks(text: &str) -> usize {
    text.matches(BLOCK_START_PREFIX).count() + text.matches(LEGACY_BLOCK_START_PREFIX).count()
}

#[test]
fn the_block_goes_at_the_end_once_and_comes_out_cleanly() {
    let user = "# Global rules\r\n\r\n- reply in Chinese\r\n";
    let added = with_block(user);
    assert!(added.starts_with("# Global rules\r\n\r\n- reply in Chinese\r\n\r\n<!-- fuyu: reply marker v5 -->\r\n"));
    assert!(added.ends_with("<!-- /fuyu: reply marker -->\r\n"));
    assert!(is_current(&added) && blocks(&added) == 1);
    assert_eq!(with_block(&added), added);
    assert_eq!(without_block(&added), user);
    assert_eq!(with_block(""), rules_file());
    assert_eq!(without_block(&rules_file()), "");

    let v4 = format!("{user}\r\n<!-- fuyu: reply marker v4 -->\r\nold\r\n{BLOCK_END}\r\n\r\n## After\r\n");
    assert!(!is_current(&v4));
    let upgraded = with_block(&v4);
    assert!(upgraded.contains("## After\r\n\r\n<!-- fuyu: reply marker v5 -->") && blocks(&upgraded) == 1);
    let legacy = format!("{user}\n<!-- focusd-island: reply marker v1 -->\nold words\n{LEGACY_BLOCK_END}\n");
    assert_eq!(blocks(&with_block(&legacy)), 1);
    let twice = format!("a\n\n{}\n\nb\n\n{}\n", block(), block());
    assert_eq!(without_block(&twice), "a\n\nb\n");
}

#[test]
fn every_harness_declares_where_its_prompt_file_lives() {
    let mut ids: Vec<_> = PROMPT_FILES.iter().map(|(id, _)| *id).collect();
    let mut harnesses: Vec<_> = super::super::harness::HARNESSES.iter().map(|harness| harness.id).collect();
    ids.sort_unstable();
    harnesses.sort_unstable();
    assert_eq!(ids, harnesses);
}

#[test]
fn enabling_writes_each_file_once_and_follows_links() {
    let home = temp_dir("links");
    let claude = home.join(".claude");
    let codex = home.join(".codex");
    let shared = home.join("dotfiles");
    for dir in [&claude, &codex, &shared] {
        fs::create_dir_all(dir).unwrap();
    }
    fs::write(shared.join("AGENTS.md"), "# mine\n").unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(shared.join("AGENTS.md"), claude.join("CLAUDE.md")).unwrap();
        std::os::unix::fs::symlink(shared.join("AGENTS.md"), codex.join("AGENTS.md")).unwrap();
    }
    #[cfg(windows)]
    if std::os::windows::fs::symlink_file(shared.join("AGENTS.md"), claude.join("CLAUDE.md")).is_err() {
        fs::remove_dir_all(&home).unwrap();
        return;
    }
    #[cfg(windows)]
    std::os::windows::fs::symlink_file(shared.join("AGENTS.md"), codex.join("AGENTS.md")).unwrap();
    let gone = home.join(".gemini");
    fs::create_dir_all(&gone).unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(home.join("unmounted").join("GEMINI.md"), gone.join("GEMINI.md")).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_file(home.join("unmounted").join("GEMINI.md"), gone.join("GEMINI.md")).unwrap();
    let own = home.join(".workbuddy");
    fs::create_dir_all(&own).unwrap();
    let list = vec![
        ("claudeCode", claude.join("CLAUDE.md")),
        ("codex", codex.join("AGENTS.md")),
        ("antigravity", gone.join("GEMINI.md")),
        ("workbuddy", own.join("CODEBUDDY.md")),
        ("opencode", home.join(".config").join("opencode").join("AGENTS.md")),
    ];

    let files = sync(&list, Change::Enable);
    assert_eq!(files.len(), 4);
    let text = fs::read_to_string(shared.join("AGENTS.md")).unwrap();
    assert_eq!(blocks(&text), 1);
    assert!(text.starts_with("# mine\n\n<!-- fuyu: reply marker v5 -->"));
    assert!(claude.join("CLAUDE.md").is_symlink());
    assert!(files[0].installed && files[1].installed && files[0].target == files[1].target);
    assert!(files[0].target.as_deref().is_some_and(|target| target.ends_with("AGENTS.md")));
    assert!(!files[2].installed && files[2].error.as_deref().is_some_and(|error| error.contains("unmounted")));
    assert!(!home.join("unmounted").exists());
    assert!(files[3].installed && files[3].target.is_none() && files[3].error.is_none());
    assert_eq!(fs::read_to_string(own.join("CODEBUDDY.md")).unwrap(), rules_file());
    assert!(!home.join(".config").exists());
    assert_eq!(sync(&list, Change::Enable), files);

    let off = sync(&list, Change::Disable);
    assert!(off.iter().all(|file| !file.installed));
    assert_eq!(fs::read_to_string(shared.join("AGENTS.md")).unwrap(), "# mine\n");
    assert_eq!(fs::read_to_string(own.join("CODEBUDDY.md")).unwrap(), "");
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn only_files_that_hold_a_block_are_upgraded() {
    let home = temp_dir("upgrade");
    let old = home.join("a.md");
    let plain = home.join("b.md");
    fs::write(&old, format!("x\n\n<!-- fuyu: reply marker v4 -->\nold\n{BLOCK_END}\n")).unwrap();
    fs::write(&plain, "y\n").unwrap();
    let list = vec![("codex", old.clone()), ("claudeCode", plain.clone())];
    let before = sync(&list, Change::Read);
    assert!(before[0].installed && before[0].outdated && !before[1].installed);
    let after = sync(&list, Change::Upgrade);
    assert!(after[0].installed && !after[0].outdated);
    assert!(is_current(&fs::read_to_string(&old).unwrap()));
    assert_eq!(fs::read_to_string(&plain).unwrap(), "y\n");
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn old_rules_files_go_only_when_they_are_the_islands() {
    let dir = temp_dir("rules");
    fs::create_dir_all(dir.join("rules")).unwrap();
    fs::write(dir.join(RULES_FILE), rules_file()).unwrap();
    fs::write(dir.join(LEGACY_RULES_FILE), "# someone else's file\n").unwrap();
    assert_eq!(old_rules(&dir), [dir.join(RULES_FILE)]);
    remove_old_rules(&dir).unwrap();
    assert!(!dir.join(RULES_FILE).exists());
    assert!(dir.join(LEGACY_RULES_FILE).exists());
    fs::write(dir.join(LEGACY_RULES_FILE), "<!-- focusd-island: reply marker v3 -->\nx\n<!-- /focusd-island: reply marker -->\n").unwrap();
    remove_old_rules(&dir).unwrap();
    assert!(!dir.join(LEGACY_RULES_FILE).exists());
    fs::remove_dir_all(&dir).unwrap();
}
