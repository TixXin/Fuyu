use std::{cell::RefCell, time::Duration};

use plugin_base::RpcError;
use serde_json::{json, Value};

use super::{apply, clear, off, read, write, Applied, Bisect, FILE};

fn scratch(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-bisect-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn sample() -> Bisect {
    Bisect { suspects: vec!["a".into(), "b".into(), "c".into(), "d".into()], off: vec!["a".into(), "b".into()], step: 1, started_at: 1_763_190_000_000 }
}

#[test]
fn the_progress_file_is_written_read_back_and_cleared() {
    let dir = scratch("roundtrip");
    assert_eq!(read(&dir), None, "no file means no bisect");
    assert!(off(&dir).is_empty());
    write(&dir, &sample()).unwrap();
    assert_eq!(read(&dir), Some(sample()));
    assert_eq!(off(&dir), ["a", "b"]);
    let saved: Value = serde_json::from_slice(&std::fs::read(dir.join(FILE)).unwrap()).unwrap();
    assert_eq!(saved["version"], 1);
    assert_eq!(saved["startedAt"], 1_763_190_000_000u64);
    assert!(saved["updatedAt"].as_u64().unwrap() >= 1_763_190_000_000);
    assert_eq!(saved["off"], json!(["a", "b"]));
    assert!(!dir.join(format!("{FILE}.tmp")).exists());
    clear(&dir).unwrap();
    assert_eq!(read(&dir), None);
    clear(&dir).unwrap();
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_broken_or_unknown_file_counts_as_no_bisect() {
    let dir = scratch("broken");
    let cases = [
        "not json",
        r#"{ "version": 2, "updatedAt": 1, "startedAt": 1, "step": 0, "suspects": [], "off": ["a"] }"#,
        r#"{ "updatedAt": 1, "startedAt": 1, "step": 0, "suspects": [], "off": ["a"] }"#,
        r#"{ "version": 1, "updatedAt": 1, "startedAt": 1, "step": 0, "suspects": [], "off": "a" }"#,
        r#"{ "version": 1, "updatedAt": 1, "startedAt": 1, "step": 0, "suspects": [], "off": [""] }"#,
        r#"[]"#,
    ];
    for text in cases {
        std::fs::write(dir.join(FILE), text).unwrap();
        assert_eq!(read(&dir), None, "{text}");
        assert!(off(&dir).is_empty(), "{text}");
    }
    std::fs::write(dir.join(FILE), r#"{ "version": 1, "updatedAt": 1, "startedAt": 1, "step": 3, "suspects": ["a"], "off": ["a"], "later": true }"#).unwrap();
    assert_eq!(off(&dir), ["a"], "fields a later version adds do not break this one");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_step_is_sent_to_the_running_host_first_and_saved_only_once_it_is_taken() {
    let dir = scratch("apply");
    let sent = RefCell::new(Vec::new());
    let applied = apply(&dir, Some(&sample()), |params| {
        sent.borrow_mut().push(params);
        Ok(Some(json!({ "off": ["a", "b"], "unknown": ["b"] })))
    })
    .unwrap();
    assert_eq!(applied, Applied { now: true, unknown: vec!["b".into()] });
    assert_eq!(sent.take(), [json!({ "off": ["a", "b"] })]);
    assert_eq!(read(&dir), Some(sample()));

    let refused = apply(&dir, Some(&Bisect { off: vec!["inside".into()], ..sample() }), |_| {
        Err(RpcError::Remote { code: json!("not-third-party"), message: "only third-party plugins can be switched off for a bisect; inside is builtin".into(), data: None })
    });
    assert!(refused.unwrap_err().contains("inside is builtin"));
    assert_eq!(read(&dir), Some(sample()), "a refused step leaves the file as it was");

    let timeout = apply(&dir, None, |_| Err(RpcError::Timeout { method: "bisect".into(), after: Duration::from_secs(5) }));
    assert!(timeout.is_err());
    assert_eq!(read(&dir), Some(sample()));

    let ended = apply(&dir, None, |params| {
        assert_eq!(params, json!({ "off": [] }));
        Ok(Some(json!({ "off": [], "unknown": [] })))
    })
    .unwrap();
    assert_eq!(ended, Applied { now: true, unknown: Vec::new() });
    assert_eq!(read(&dir), None);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn without_a_running_host_the_step_is_saved_for_the_next_start() {
    let dir = scratch("down");
    assert_eq!(apply(&dir, Some(&sample()), |_| Ok(None)).unwrap(), Applied::default());
    assert_eq!(read(&dir), Some(sample()));
    let calls = RefCell::new(0);
    let late = apply(&dir, Some(&sample()), |_| {
        *calls.borrow_mut() += 1;
        Ok((*calls.borrow() == 2).then(|| json!({ "off": ["a", "b"], "unknown": [] })))
    })
    .unwrap();
    assert!(late.now, "a host that became ready while the file was being written gets the step too");
    let gone = apply(&dir, None, |_| Err(RpcError::PeerGone("the plugin host exited".into()))).unwrap();
    assert!(!gone.now);
    assert_eq!(read(&dir), None);
    assert!(apply(&dir, Some(&Bisect { off: vec![String::new()], ..sample() }), |_| panic!("an empty id is never sent")).is_err());
    let _ = std::fs::remove_dir_all(&dir);
}
