use super::*;

fn ids(text: &str) -> Vec<String> {
    disabled_ids(text).into_iter().collect()
}

#[test]
fn reads_the_disabled_built_in_entries() {
    let text = "- id: timer\n  disabled: true\n- id: translation\n  config:\n    engine: google\n- id: hello\n  name: ./hello.mjs\n  disabled: false\n- disabled: TRUE\n  id: 'clipboard' # off for now\n";
    assert_eq!(ids(text), ["clipboard", "timer"]);
    assert!(ids("[]\n").is_empty());
    assert!(ids("").is_empty());
    assert!(ids("[{ id: timer, disabled: true }]").is_empty());
    assert!(ids("- id: group\n  config:\n    - id: timer\n      disabled: true\n").is_empty());
}

#[test]
fn shapes() {
    assert_eq!(shape(""), Shape::Empty);
    assert_eq!(shape("# nothing yet\n[]\n"), Shape::Empty);
    assert_eq!(shape("- id: a\n"), Shape::Block);
    assert_eq!(shape("plugins:\n  - id: a\n"), Shape::Other);
    assert_eq!(shape("[{ id: a }]"), Shape::Other);
}

#[test]
fn switching_off_appends_an_entry_or_marks_the_existing_one() {
    assert_eq!(set_disabled("[]\n", "timer", true).unwrap(), "- id: timer\n  disabled: true\n");
    assert_eq!(set_disabled("", "timer", true).unwrap(), "- id: timer\n  disabled: true\n");
    assert_eq!(set_disabled("- id: hello\n  name: ./hello.mjs", "timer", true).unwrap(), "- id: hello\n  name: ./hello.mjs\n- id: timer\n  disabled: true\n");
    assert_eq!(set_disabled("- id: timer\n  config:\n    sound: false\n- id: hello\n", "timer", true).unwrap(), "- id: timer\n  config:\n    sound: false\n  disabled: true\n- id: hello\n");
    assert_eq!(set_disabled("- id: timer\n  disabled: false\n", "timer", true).unwrap(), "- id: timer\n  disabled: true\n");
    assert_eq!(set_disabled("- disabled: false\n  id: timer\n", "timer", true).unwrap(), "- disabled: true\n  id: timer\n");
    let already = "- id: timer\n  disabled: true\n";
    assert_eq!(set_disabled(already, "timer", true).unwrap(), already);
}

#[test]
fn switching_on_drops_the_line_or_the_whole_entry() {
    assert_eq!(set_disabled("- id: hello\n- id: timer\n  disabled: true\n- id: other\n", "timer", false).unwrap(), "- id: hello\n- id: other\n");
    assert_eq!(set_disabled("- id: timer\n  disabled: true\n  config:\n    sound: false\n", "timer", false).unwrap(), "- id: timer\n  config:\n    sound: false\n");
    assert_eq!(set_disabled("- disabled: true\n  id: timer\n  config: {}\n", "timer", false).unwrap(), "- disabled: false\n  id: timer\n  config: {}\n");
    assert_eq!(set_disabled("- id: hello\n", "timer", false).unwrap(), "- id: hello\n");
    assert_eq!(set_disabled("[]\n", "timer", false).unwrap(), "[]\n");
}

#[test]
fn keeps_comments_other_entries_and_line_endings() {
    let text = "# my plugins\r\n- id: hello\r\n  name: ./hello.mjs\r\n\r\n# kept\r\n- id: group\r\n  config:\r\n    - id: inner\r\n";
    let off = set_disabled(text, "timer", true).unwrap();
    assert_eq!(off, format!("{text}- id: timer\r\n  disabled: true\r\n"));
    assert_eq!(set_disabled(&off, "timer", false).unwrap(), text);
}

#[test]
fn refuses_a_file_it_cannot_edit_safely() {
    let error = set_disabled("[{ id: timer }]\n", "timer", true).unwrap_err();
    assert!(error.contains("timer"), "{error}");
}

#[test]
fn round_trips_every_built_in() {
    let mut text = String::from("[]\n");
    for id in ["todos", "timer", "updater"] {
        text = set_disabled(&text, id, true).unwrap();
    }
    assert_eq!(ids(&text), ["timer", "todos", "updater"]);
    for id in ["todos", "timer", "updater"] {
        text = set_disabled(&text, id, false).unwrap();
    }
    assert_eq!(text, "[]\n");
}
