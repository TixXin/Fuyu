use std::collections::BTreeMap;

use super::{
    apply_registered, clear, merge_conflicts, prepare, snapshot_counts, sync_hotkeys,
    PluginHotkeyBindings, PluginHotkeySpec,
};

fn spec(plugin_id: &str, command: &str, shortcut: &str) -> PluginHotkeySpec {
    PluginHotkeySpec {
        plugin_id: plugin_id.to_owned(),
        command: command.to_owned(),
        shortcut: shortcut.to_owned(),
    }
}

#[test]
fn invalid_and_duplicate_shortcuts_are_reported_per_plugin_while_empty_ones_are_ignored() {
    let (wanted, conflicts) = prepare(&[
        spec("alpha", "open", "ctrl + shift + p"),
        spec("beta", "toggle", "Control+Shift+P"),
        spec("beta", "bad", "NotAShortcut"),
        spec("beta", "no-modifier", "K"),
        spec("gamma", "unbound", "   "),
        spec("", "missing-plugin", "Ctrl+Alt+M"),
        spec("gamma", "", "Ctrl+Alt+N"),
        spec("gamma", "run", "Ctrl+Alt+G"),
    ]);
    assert_eq!(wanted.len(), 2);
    assert_eq!((wanted[0].plugin_id.as_str(), wanted[0].command.as_str(), wanted[0].label.as_str()), ("alpha", "open", "Ctrl+Shift+P"));
    assert_eq!((wanted[1].plugin_id.as_str(), wanted[1].command.as_str(), wanted[1].label.as_str()), ("gamma", "run", "Ctrl+Alt+G"));
    let mut expected = BTreeMap::new();
    expected.insert("beta".to_owned(), vec!["Ctrl+Shift+P".to_owned(), "NotAShortcut".to_owned(), "K".to_owned()]);
    assert_eq!(conflicts, expected);
}

#[test]
fn os_rejected_shortcuts_merge_into_conflicts_without_duplicates() {
    let (wanted, mut conflicts) = prepare(&[
        spec("alpha", "one", "Ctrl+Alt+1"),
        spec("alpha", "two", "Ctrl+Alt+2"),
        spec("alpha", "dup", "Ctrl+Alt+1"),
        spec("beta", "three", "Ctrl+Alt+3"),
    ]);
    let (registered, os_conflicts) = apply_registered(wanted, |binding, _| binding.label != "Ctrl+Alt+2");
    merge_conflicts(&mut conflicts, os_conflicts);
    assert_eq!(registered.len(), 2);
    assert_eq!(registered[0].command, "one");
    assert_eq!(registered[1].plugin_id, "beta");
    assert_eq!(
        conflicts.get("alpha").map(Vec::as_slice),
        Some(&["Ctrl+Alt+1".to_owned(), "Ctrl+Alt+2".to_owned()][..]),
    );
    assert!(!conflicts.contains_key("beta"));
}

#[test]
fn sync_and_clear_update_and_reset_tracked_hotkey_state() {
    clear();
    let result = sync_hotkeys(PluginHotkeyBindings(vec![
        spec("notes", "quickCapture", "Ctrl+Shift+N"),
        spec("notes", "conflict", "Ctrl+Shift+N"),
        spec("clock", "toggle", "BadKey"),
    ]));
    assert_eq!(result.conflicts.get("notes").map(Vec::as_slice), Some(&["Ctrl+Shift+N".to_owned()][..]));
    assert_eq!(result.conflicts.get("clock").map(Vec::as_slice), Some(&["BadKey".to_owned()][..]));
    let (wanted, registered, stored_conflicts) = snapshot_counts();
    assert_eq!((wanted, registered), (1, 1));
    assert_eq!(stored_conflicts, result.conflicts);

    clear();
    let (wanted_after, registered_after, conflicts_after) = snapshot_counts();
    assert_eq!((wanted_after, registered_after), (0, 0));
    assert!(conflicts_after.is_empty());
}
