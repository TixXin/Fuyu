use serde_json::json;

use super::spec::{apply_options, centered, fit, parse_create, parse_update, pick_screen, system_title, Kind, Layer, Options, Rect, ScreenArea, MIN_SIDE};
use super::{layer_after_rules, WindowRules};

fn screen(id: &str, x: i32, width: i32, primary: bool) -> ScreenArea {
    let bounds = Rect { x, y: 0, width, height: 1080 };
    ScreenArea { id: id.into(), bounds, work_area: Rect { height: 1040, ..bounds }, scale: 1.0, primary }
}

#[test]
fn create_reads_kind_entry_and_defaults_per_kind() {
    let panel = parse_create(&json!({ "id": "launcher", "kind": "panel", "entry": "ui/launcher.html" })).expect("valid");
    assert_eq!(panel.kind, Kind::Panel);
    assert_eq!(panel.options.layer, Layer::Topmost);
    assert!(panel.visible);
    let widget = parse_create(&json!({ "id": "clock", "kind": "widget", "entry": "clock.htm", "visible": false })).expect("valid");
    assert_eq!(widget.options.layer, Layer::Desktop);
    assert!(!widget.visible);
}

#[test]
fn create_refuses_bad_ids_entries_and_kinds() {
    for params in [
        json!({ "id": "", "kind": "panel", "entry": "a.html" }),
        json!({ "id": "has space", "kind": "panel", "entry": "a.html" }),
        json!({ "id": "a", "kind": "dialog", "entry": "a.html" }),
        json!({ "id": "a", "kind": "panel", "entry": "../a.html" }),
        json!({ "id": "a", "kind": "panel", "entry": "/a.html" }),
        json!({ "id": "a", "kind": "panel", "entry": "C:/a.html" }),
        json!({ "id": "a", "kind": "panel", "entry": "a.js" }),
        json!({ "id": "a", "kind": "panel", "entry": "a.html?x=1" }),
    ] {
        assert_eq!(parse_create(&params).expect_err("invalid").0, 400, "{params}");
    }
}

#[test]
fn options_are_checked() {
    let mut options = Options::defaults(Kind::Widget);
    assert!(apply_options(&mut options, Kind::Widget, &json!({ "opacity": 0.1 })).is_err());
    assert!(apply_options(&mut options, Kind::Widget, &json!({ "layer": "above" })).is_err());
    assert!(apply_options(&mut options, Kind::Widget, &json!({ "hideOnBlur": true })).is_err(), "widgets never take the focus");
    assert!(apply_options(&mut options, Kind::Widget, &json!({ "minSize": { "width": 300, "height": 300 }, "maxSize": { "width": 200, "height": 400 } })).is_err());
    apply_options(&mut options, Kind::Widget, &json!({ "opacity": 0.5, "layer": "normal", "clickThrough": true, "minSize": { "width": 10, "height": 10 } })).expect("valid");
    assert_eq!(options.opacity, 0.5);
    assert_eq!(options.layer, Layer::Normal);
    assert!(options.click_through);
    assert_eq!(options.min_size, (MIN_SIDE, MIN_SIDE));
}

#[test]
fn update_cannot_change_kind_or_entry_or_unknown_fields() {
    assert!(parse_update(&json!({ "id": "a", "kind": "widget" })).is_err());
    assert!(parse_update(&json!({ "id": "a", "entry": "b.html" })).is_err());
    assert!(parse_update(&json!({ "id": "a", "color": "red" })).is_err());
    let update = parse_update(&json!({ "id": "a", "bounds": { "x": 1, "y": 2, "width": 300, "height": 200 }, "opacity": 0.8 })).expect("valid");
    assert_eq!(update.placement.and_then(|placement| placement.bounds), Some(Rect { x: 1, y: 2, width: 300, height: 200 }));
    assert!(update.fields.contains_key("opacity"));
}

#[test]
fn windows_stay_on_a_screen_and_within_its_work_area() {
    let screens = [screen("one", 0, 1920, true), screen("two", 1920, 1280, false)];
    let off = fit(Rect { x: 5000, y: 3000, width: 400, height: 300 }, (MIN_SIDE, MIN_SIDE), None, &screens, None);
    assert!(screens.iter().any(|screen| {
        let area = screen.work_area;
        off.x + MIN_SIDE <= area.x + area.width && off.x + off.width >= area.x + MIN_SIDE && off.y >= area.y && off.y + MIN_SIDE <= area.y + area.height
    }), "{off:?}");
    let huge = fit(Rect { x: 0, y: 0, width: 9000, height: 9000 }, (MIN_SIDE, MIN_SIDE), None, &screens, None);
    assert_eq!((huge.width, huge.height), (1920, 1040), "no bigger than the work area: never covers every screen");
    let tiny = fit(Rect { x: 10, y: 10, width: 1, height: 1 }, (MIN_SIDE, MIN_SIDE), None, &screens, None);
    assert_eq!((tiny.width, tiny.height), (MIN_SIDE, MIN_SIDE));
    let partly = Rect { x: -100, y: 100, width: 400, height: 300 };
    assert_eq!(fit(partly, (MIN_SIDE, MIN_SIDE), None, &screens, None), partly, "enough of it is visible");
}

#[test]
fn screens_are_picked_by_id_by_overlap_or_primary() {
    let screens = [screen("one", 0, 1920, false), screen("two", 1920, 1280, true)];
    assert_eq!(pick_screen(&screens, Some("one"), None).map(|screen| screen.id.as_str()), Some("one"));
    assert_eq!(pick_screen(&screens, None, None).map(|screen| screen.id.as_str()), Some("two"));
    let near_one = Rect { x: 100, y: 100, width: 10, height: 10 };
    assert_eq!(pick_screen(&screens, None, Some(near_one)).map(|screen| screen.id.as_str()), Some("one"));
    let middle = centered(Kind::Panel, &screens[0]);
    assert_eq!((middle.x + middle.width / 2, middle.y + middle.height / 2), (960, 520));
}

#[test]
fn the_user_rules_win_and_the_title_keeps_the_suffix() {
    let rules = WindowRules { no_topmost: true, ..WindowRules::default() };
    assert_eq!(layer_after_rules(Layer::Topmost, rules), Layer::Normal);
    assert_eq!(layer_after_rules(Layer::Desktop, rules), Layer::Desktop);
    assert_eq!(layer_after_rules(Layer::Topmost, WindowRules::default()), Layer::Topmost);
    assert_eq!(system_title("Launcher"), "Launcher · 浮屿");
}
