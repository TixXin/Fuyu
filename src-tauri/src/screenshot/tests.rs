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
