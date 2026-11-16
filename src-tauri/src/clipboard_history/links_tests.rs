use super::*;

fn link(id: &str, url: &str) -> ClipboardLink {
    ClipboardLink { id: id.into(), url: url.into(), title: String::new(), added_at: 0, sort_key: String::new(), updated_at: None, device_id: None }
}

fn keyed(ids: &[&str]) -> ClipboardLinks {
    let links = ids.iter().map(|id| link(id, &format!("https://{id}.com/"))).collect();
    let mut links = normalized(ClipboardLinks { links, ..ClipboardLinks::default() });
    fill_missing(&mut links, "dev1");
    links
}

fn order(links: &ClipboardLinks) -> Vec<&str> {
    links.links.iter().map(|link| link.id.as_str()).collect()
}

#[test]
fn urls_get_a_scheme_and_only_web_addresses_count() {
    assert_eq!(normalized_url("example.com/a").as_deref(), Some("https://example.com/a"));
    assert_eq!(normalized_url(" https://GitHub.com/x ").as_deref(), Some("https://github.com/x"));
    assert_eq!(normalized_url("http://localhost:5173/").as_deref(), Some("http://localhost:5173/"));
    assert!(normalized_url("ftp://example.com").is_none());
    assert!(normalized_url("not a link").is_none());
    assert!(normalized_url("intranet/page").is_none());
    assert!(normalized_url("").is_none());
}

#[test]
fn sites_keep_only_the_host() {
    let sites = normalized_sites(&["https://www.Google.com/search?q=1".into(), "*.github.com".into(), "user@host.io:8080".into(), "google.com".into(), " ".into()]);
    assert_eq!(sites, vec!["google.com", "github.com", "host.io"]);
}

#[test]
fn adding_skips_duplicates_and_puts_new_links_first() {
    let mut links = ClipboardLinks { links: vec![link("a", "https://a.com/")], ..ClipboardLinks::default() };
    let added = add_links(&mut links, [("https://b.com".into(), "  B  site ".into()), ("a.com".into(), String::new()), ("nope".into(), String::new())]);
    assert_eq!(added, 1);
    assert_eq!(links.links[0].url, "https://b.com/");
    assert_eq!(links.links[0].title, "B site");
    assert_eq!(links.links[1].id, "a");
}

#[test]
fn moving_clamps_to_the_end() {
    let mut links = ClipboardLinks { links: vec![link("a", "https://a.com/"), link("b", "https://b.com/"), link("c", "https://c.com/")], ..ClipboardLinks::default() };
    assert!(move_link(&mut links, "a", 9).is_ok());
    assert_eq!(links.links.iter().map(|link| link.id.as_str()).collect::<Vec<_>>(), ["b", "c", "a"]);
    assert!(move_link(&mut links, "c", 0).is_ok());
    assert_eq!(links.links[0].id, "c");
    assert_eq!(move_link(&mut links, "zzz", 0).err().map(|error| error.code()), Some("clipboard.linkMissing"));
}

#[test]
fn loading_drops_broken_entries_and_fills_missing_fields() {
    let dir = std::env::temp_dir().join(format!("fuyu-links-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("temp dir");
    let path = dir.join(FILE_NAME);
    std::fs::write(&path, r#"{"links":[{"id":"x","url":"https://a.com"},{"id":"x","url":"b.com"},{"id":"y","url":"bad"},{"id":"z","url":"https://a.com/"}],"settings":{"blockedSites":["WWW.X.com"]}}"#).expect("write");
    let loaded = load(&path);
    assert_eq!(loaded.version, 2);
    assert!(links_order::is_ordered(loaded.links.iter().map(|link| link.sort_key.as_str())));
    assert!(loaded.settings.notice);
    assert_eq!(loaded.settings.blocked_sites, vec!["x.com"]);
    assert_eq!(loaded.links.iter().map(|link| link.url.as_str()).collect::<Vec<_>>(), ["https://a.com/", "https://b.com/"]);
    assert_ne!(loaded.links[0].id, loaded.links[1].id);
    std::fs::write(&path, "not json").expect("write");
    assert_eq!(load(&path).links.len(), 0);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn imports_read_our_export_a_bare_list_or_plain_lines() {
    let ours = super::super::links_transfer::parse(r#"{"app":"fuyu-links","links":[{"url":"https://a.com","title":"A"}]}"#);
    assert_eq!(ours, vec![("https://a.com".to_string(), "A".to_string())]);
    let list = super::super::links_transfer::parse(r#"["https://b.com", {"url":"https://c.com"}]"#);
    assert_eq!(list.len(), 2);
    let lines = super::super::links_transfer::parse("https://d.com\n  not a link\nhttp://e.com/x  \n");
    assert_eq!(lines, vec![("https://d.com".to_string(), String::new()), ("http://e.com/x".to_string(), String::new())]);
}

#[test]
fn only_short_single_words_with_a_dot_go_to_the_island() {
    use super::super::copy_notice::looks_like_link;
    assert!(looks_like_link(" https://example.com/a "));
    assert!(looks_like_link("example.com"));
    assert!(!looks_like_link("hello world.com"));
    assert!(!looks_like_link("localhost"));
    assert!(!looks_like_link(&format!("https://a.com/{}", "x".repeat(3000))));
}

#[test]
fn an_old_file_reads_with_keys_in_its_order_and_times_from_added_at() {
    let mut links = normalized(serde_json::from_str(r#"{"version":1,"links":[{"id":"b","url":"https://b.com","addedAt":200},{"id":"a","url":"https://a.com","addedAt":100}]}"#).expect("v1 file"));
    fill_missing(&mut links, "dev1");
    assert_eq!(links.version, 2);
    assert_eq!(order(&links), ["b", "a"]);
    assert!(links.links[0].sort_key < links.links[1].sort_key);
    assert_eq!(links.links[0].updated_at, Some(Hlc::from_millis(200, "dev1")));
    assert_eq!(links.links[1].device_id.as_deref(), Some("dev1"));
    let written = serde_json::to_string(&links).expect("encode");
    let again = normalized(serde_json::from_str(&written).expect("v2 file"));
    assert_eq!(again, links);
}

#[test]
fn moving_one_link_changes_only_its_key_and_time() {
    let mut clock = Clock::new("dev1");
    let old = keyed(&["a", "b", "c", "d"]);
    let mut next = old.clone();
    assert!(move_link(&mut next, "d", 1).is_ok());
    let next = restamp(&old, next, &mut clock, 9_000);
    assert_eq!(order(&next), ["a", "d", "b", "c"]);
    assert!(links_order::is_ordered(next.links.iter().map(|link| link.sort_key.as_str())));
    for id in ["a", "b", "c"] {
        let find = |links: &ClipboardLinks| links.links.iter().find(|link| link.id == id).cloned();
        assert_eq!(find(&next), find(&old), "{id}");
    }
    assert_eq!(next.links[1].updated_at, Some(Hlc::from_millis(9_000, "dev1")));
    let mut same = next.clone();
    assert!(move_link(&mut same, "d", 1).is_ok());
    assert_eq!(restamp(&next, same, &mut clock, 10_000), next);
}

#[test]
fn removing_leaves_a_tombstone_and_settings_do_not_touch_links() {
    let mut clock = Clock::new("dev1");
    let old = keyed(&["a", "b"]);
    let mut next = old.clone();
    next.links.retain(|link| link.id != "a");
    next.settings.notice = false;
    let next = restamp(&old, next, &mut clock, 9_000);
    assert_eq!(next.tombstones, vec![Tombstone::new("a", Hlc::from_millis(9_000, "dev1"))]);
    assert_eq!(next.links[0], old.links[1]);
    let mut back = next.clone();
    back.links.push(old.links[0].clone());
    assert!(restamp(&next, back, &mut clock, 9_500).tombstones.is_empty());
}

#[test]
fn imported_links_are_new_local_changes_at_the_top() {
    let mut clock = Clock::new("dev1");
    let old = keyed(&["a"]);
    let mut next = old.clone();
    let entries = super::super::links_transfer::parse(r#"{"app":"fuyu-links","links":[{"url":"https://x.com","title":"X","updatedAt":"001000000000000-000000-other"},{"url":"https://y.com"}]}"#);
    assert_eq!(add_links(&mut next, entries), 2);
    let next = restamp(&old, next, &mut clock, 9_000);
    assert_eq!(next.links.iter().map(|link| link.url.as_str()).collect::<Vec<_>>(), ["https://x.com/", "https://y.com/", "https://a.com/"]);
    assert!(links_order::is_ordered(next.links.iter().map(|link| link.sort_key.as_str())));
    assert!(next.links[..2].iter().all(|link| link.device_id.as_deref() == Some("dev1") && link.updated_at.as_ref().is_some_and(|stamp| stamp.ms == 9_000)));
    assert_eq!(next.links[2], old.links[0]);
}
