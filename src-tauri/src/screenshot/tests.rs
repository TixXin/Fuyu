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
