use super::session::{crop, PixelRect};

/// A 4 × 3 picture whose pixel (x, y) is [x, y, 0, 255].
fn picture() -> Vec<u8> {
    (0..3u8).flat_map(|y| (0..4u8).flat_map(move |x| [x, y, 0, 255])).collect()
}

#[test]
fn a_selection_is_cut_out_row_by_row() {
    let (width, height, pixels) = crop(&picture(), 4, 3, PixelRect { x: 1, y: 1, width: 2, height: 2 }).expect("inside");
    assert_eq!((width, height), (2, 2));
    assert_eq!(pixels, [1, 1, 0, 255, 2, 1, 0, 255, 1, 2, 0, 255, 2, 2, 0, 255]);
}

#[test]
fn a_selection_past_the_edge_is_clipped_and_one_outside_is_nothing() {
    let (width, height, _) = crop(&picture(), 4, 3, PixelRect { x: 3, y: 2, width: 10, height: 10 }).expect("one pixel left");
    assert_eq!((width, height), (1, 1));
    assert!(crop(&picture(), 4, 3, PixelRect { x: 4, y: 0, width: 1, height: 1 }).is_none());
    assert!(crop(&picture(), 4, 3, PixelRect { x: 0, y: 0, width: 0, height: 3 }).is_none());
    // A picture shorter than its size says is not read past its end.
    assert!(crop(&picture()[..8], 4, 3, PixelRect { x: 0, y: 0, width: 1, height: 1 }).is_none());
}

#[test]
fn annotated_pixels_are_laid_over_the_selection_only_where_they_fit() {
    use super::output::{lay_over, Picture};
    let mut shot = Picture { width: 4, height: 3, rgba: picture() };
    let patch = [9u8; 2 * 4];
    assert!(lay_over(&mut shot, PixelRect { x: 1, y: 2, width: 2, height: 1 }, &patch));
    assert_eq!(&shot.rgba[(2 * 4 + 1) * 4..(2 * 4 + 3) * 4], &patch);
    assert_eq!(&shot.rgba[(2 * 4) * 4..(2 * 4 + 1) * 4], &[0, 2, 0, 255]);
    let before = shot.rgba.clone();
    assert!(!lay_over(&mut shot, PixelRect { x: 3, y: 0, width: 2, height: 1 }, &patch), "past the right edge");
    assert!(!lay_over(&mut shot, PixelRect { x: 0, y: 0, width: 1, height: 1 }, &patch), "wrong size");
    assert!(!lay_over(&mut shot, PixelRect { x: u32::MAX, y: 0, width: 2, height: 1 }, &patch), "overflowing");
    assert_eq!(shot.rgba, before);
}

#[test]
fn the_clipboard_bitmap_is_bgra_bottom_up_behind_its_header() {
    use super::output::{dib, Picture};
    let bitmap = dib(&Picture { width: 4, height: 3, rgba: picture() });
    assert_eq!(bitmap.len(), 40 + 4 * 3 * 4);
    assert_eq!(&bitmap[..4], &40u32.to_le_bytes());
    assert_eq!(&bitmap[4..12], &[4, 0, 0, 0, 3, 0, 0, 0]);
    assert_eq!(&bitmap[14..16], &32u16.to_le_bytes());
    // The first row stored is the picture's last (y = 2), each pixel as B, G, R, A.
    assert_eq!(&bitmap[40..48], &[0, 2, 0, 255, 0, 2, 1, 255]);
}

#[test]
fn composed_pixels_must_match_their_size() {
    use super::pixels_fit;
    assert!(pixels_fit(2 * 3 * 4, 2, 3));
    assert!(!pixels_fit(2 * 3 * 4 - 1, 2, 3));
    assert!(!pixels_fit(0, 0, 3));
    assert!(!pixels_fit(usize::MAX, u32::MAX, u32::MAX));
}

#[test]
fn targets_are_clipped_to_each_monitor_and_moved_into_its_pixels() {
    use super::targets::{localize, target};
    // A window across two monitors: the left one at (-1920, 0), the right one at (0, 0).
    let targets = [target(0, false, (-100, 50, 300, 450)), target(0, true, (10, 60, 90, 80)), target(1, false, (2000, 0, 2100, 100))];
    let json = |target| serde_json::to_value(target).expect("serializes");
    let right = localize(&targets, (0, 0), (2560, 1440));
    assert_eq!(right.len(), 3);
    assert_eq!(json(right[0]), serde_json::json!({ "window": 0, "element": false, "x": 0, "y": 50, "width": 300, "height": 400 }));
    assert_eq!(json(right[1])["element"], true);
    let left = localize(&targets, (-1920, 0), (1920, 1080));
    assert_eq!(left.len(), 1);
    assert_eq!(json(left[0]), serde_json::json!({ "window": 0, "element": false, "x": 1820, "y": 50, "width": 100, "height": 400 }));
}

#[test]
fn folder_names_and_actions_come_through_headers() {
    use super::{percent_decode, Action};
    assert_eq!(percent_decode("%E6%B5%AE%E5%B1%BF%E6%88%AA%E5%9B%BE").as_deref(), Some("浮屿截图"));
    assert_eq!(percent_decode(r"D%3A%5CShots").as_deref(), Some(r"D:\Shots"));
    assert_eq!(percent_decode("plain").as_deref(), Some("plain"));
    assert!(percent_decode("%E6%B5").is_none());
    assert!(percent_decode("%4").is_none());
    assert_eq!(Action::parse("pin"), Some(Action::Pin));
    assert_eq!(Action::parse("copy"), Some(Action::Copy));
    assert_eq!(Action::parse("save"), Some(Action::Save));
    assert_eq!(Action::parse("text"), Some(Action::Text));
    assert_eq!(Action::parse("translate"), Some(Action::Translate));
    assert_eq!(Action::parse("upload"), None);
}

#[test]
fn a_zoomed_pin_keeps_the_point_under_the_pointer() {
    use super::pin::zoomed;
    // A 200 × 100 picture at (1000, 500), shown at its own size, zoomed to 2× about its middle.
    assert_eq!(zoomed((1000, 500), (200, 100), (200, 100), 2.0, (0.5, 0.5)), (900, 450, 400, 200));
    // About its top-left corner it grows right and down.
    assert_eq!(zoomed((1000, 500), (200, 100), (200, 100), 0.5, (0.0, 0.0)), (1000, 500, 100, 50));
    // Never smaller than a grabbable size, never past 8×, and a broken scale is 1×.
    assert_eq!(zoomed((0, 0), (20, 20), (20, 20), 0.01, (0.0, 0.0)).2, 16);
    assert_eq!(zoomed((0, 0), (10, 10), (10, 10), 100.0, (0.0, 0.0)).2, 80);
    assert_eq!(zoomed((0, 0), (20, 20), (20, 20), f64::NAN, (0.0, 0.0)).2, 20);
}

#[test]
fn only_the_newest_fifty_screenshots_of_the_last_week_are_kept() {
    use super::output::stale;
    use std::{path::PathBuf, time::{Duration, SystemTime}};
    let now = SystemTime::now();
    let day = Duration::from_secs(24 * 60 * 60);
    let mut files: Vec<(SystemTime, PathBuf)> = (0..52u64).map(|minute| (now - Duration::from_secs(minute * 60), PathBuf::from(format!("{minute}.png")))).collect();
    files.push((now - 8 * day, PathBuf::from("old.png")));
    let mut gone = stale(&mut files, now);
    gone.sort();
    assert_eq!(gone, [PathBuf::from("50.png"), PathBuf::from("51.png"), PathBuf::from("old.png")]);
}

#[test]
fn saved_files_get_a_time_in_their_name_and_never_overwrite() {
    use super::output::{file_name_in, sanitized_name};
    use chrono::TimeZone;
    let folder = std::env::temp_dir().join(format!("fuyu-screenshot-test-{}", std::process::id()));
    std::fs::create_dir_all(&folder).expect("temp folder");
    let at = chrono::Local.with_ymd_and_hms(2026, 11, 12, 10, 30, 15).single().expect("a time");
    let first = file_name_in(&folder, at);
    assert_eq!(first.file_name().and_then(|name| name.to_str()), Some("Fuyu_2026-11-12_10-30-15.png"));
    std::fs::write(&first, b"").expect("write");
    let second = file_name_in(&folder, at);
    assert_eq!(second.file_name().and_then(|name| name.to_str()), Some("Fuyu_2026-11-12_10-30-15_2.png"));
    let _ = std::fs::remove_dir_all(&folder);
    assert_eq!(sanitized_name("浮屿截图"), "浮屿截图");
    assert_eq!(sanitized_name("a/b:c*."), "abc");
    assert_eq!(sanitized_name(" ?? "), "Fuyu");
}
