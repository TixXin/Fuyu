use super::session::{crop, PixelRect};

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
    assert_eq!(zoomed((1000, 500), (200, 100), (200, 100), 2.0, (0.5, 0.5)), (900, 450, 400, 200));
    assert_eq!(zoomed((1000, 500), (200, 100), (200, 100), 0.5, (0.0, 0.0)), (1000, 500, 100, 50));
    assert_eq!(zoomed((0, 0), (20, 20), (20, 20), 0.01, (0.0, 0.0)).2, 16);
    assert_eq!(zoomed((0, 0), (10, 10), (10, 10), 100.0, (0.0, 0.0)).2, 80);
    assert_eq!(zoomed((0, 0), (20, 20), (20, 20), f64::NAN, (0.0, 0.0)).2, 20);
}

#[test]
fn only_the_newest_hundred_screenshots_within_the_kept_days_stay() {
    use super::output::stale;
    use std::{path::PathBuf, time::{Duration, SystemTime}};
    let now = SystemTime::now();
    let day = Duration::from_secs(24 * 60 * 60);
    let mut files: Vec<(SystemTime, PathBuf)> = (0..102u64).map(|minute| (now - Duration::from_secs(minute * 60), PathBuf::from(format!("{minute}.png")))).collect();
    files.push((now - 8 * day, PathBuf::from("old.png")));
    let mut gone = stale(&mut files, now, 7 * day);
    gone.sort();
    assert_eq!(gone, [PathBuf::from("100.png"), PathBuf::from("101.png"), PathBuf::from("old.png")]);
    let mut week_old = vec![(now - 8 * day, PathBuf::from("old.png"))];
    assert!(stale(&mut week_old, now, 30 * day).is_empty(), "kept for 30 days, an 8-day-old one stays");
    assert_eq!(stale(&mut week_old, now, day).len(), 1);
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

#[test]
fn a_chosen_save_folder_must_be_a_full_path_without_parent_steps() {
    use super::output::chosen_folder;
    assert!(chosen_folder(r"D:\Screenshots").is_ok());
    assert!(chosen_folder(r"\\nas\shots").is_ok());
    assert!(chosen_folder("Screenshots").is_err());
    assert!(chosen_folder(r"D:\Screenshots\..\Windows").is_err());
}

#[test]
fn the_history_lists_newest_first_with_thumbnails_and_only_hands_out_its_own_files() {
    use super::history::{history_file, list};
    use super::output::{encode_png, Picture};
    let dir = std::env::temp_dir().join(format!("fuyu-screenshot-history-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("temp folder");
    let png = encode_png(&Picture { width: 4, height: 2, rgba: vec![255; 4 * 2 * 4] }).expect("png");
    std::fs::write(dir.join("a.png"), &png).expect("write a");
    std::thread::sleep(std::time::Duration::from_millis(30));
    std::fs::write(dir.join("b.png"), &png).expect("write b");
    std::fs::write(dir.join("note.txt"), b"x").expect("write txt");
    let items = list(&dir);
    assert_eq!(items.iter().map(|item| item.path.rsplit(['\\', '/']).next().unwrap_or_default()).collect::<Vec<_>>(), ["b.png", "a.png"]);
    assert!(items.iter().all(|item| item.thumbnail.as_deref().is_some_and(|data| data.starts_with("data:image/png;base64,"))));
    assert!(items[0].taken_at >= items[1].taken_at);
    assert!(history_file(&dir, &items[0].path).is_ok());
    assert!(history_file(&dir, &dir.join("note.txt").display().to_string()).is_err());
    assert!(history_file(&dir, &dir.join("missing.png").display().to_string()).is_err());
    assert!(history_file(&dir, &std::env::temp_dir().join("b.png").display().to_string()).is_err());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_pin_from_the_history_opens_round_the_pointer_and_stays_on_its_monitor() {
    use super::history::pin_origin;
    let monitor = (-1920, 0, 1920, 1080);
    assert_eq!(pin_origin(Some((-960, 540)), monitor, (200, 100)), (-1060, 490));
    assert_eq!(pin_origin(Some((-1910, 10)), monitor, (200, 100)), (-1920, 0));
    assert_eq!(pin_origin(Some((-5, 1075)), monitor, (200, 100)), (-200, 980));
    assert_eq!(pin_origin(None, monitor, (200, 100)), (-1060, 490));
    assert_eq!(pin_origin(Some((-960, 540)), monitor, (4000, 3000)), (-1920, 0));
}

#[test]
fn kept_days_take_only_the_offered_choices() {
    use super::history::{keep_for, set_keep_days};
    let day = std::time::Duration::from_secs(24 * 60 * 60);
    set_keep_days(30);
    assert_eq!(keep_for(), 30 * day);
    set_keep_days(5);
    assert_eq!(keep_for(), 7 * day);
}
