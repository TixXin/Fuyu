use serde::Deserialize;

use super::output::Picture;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PinTurn {
    Left,
    Right,
    FlipX,
    FlipY,
}

impl PinTurn {
    fn swaps_sides(self) -> bool {
        matches!(self, Self::Left | Self::Right)
    }
}

pub(super) fn turn_picture(picture: &Picture, turn: PinTurn) -> Picture {
    let (width, height) = (picture.width as usize, picture.height as usize);
    let (out_width, out_height) = if turn.swaps_sides() { (height, width) } else { (width, height) };
    let mut rgba = vec![0u8; out_width * out_height * 4];
    for y in 0..height {
        for x in 0..width {
            let (to_x, to_y) = match turn {
                PinTurn::Right => (height - 1 - y, x),
                PinTurn::Left => (y, width - 1 - x),
                PinTurn::FlipX => (width - 1 - x, y),
                PinTurn::FlipY => (x, height - 1 - y),
            };
            let from = (y * width + x) * 4;
            let to = (to_y * out_width + to_x) * 4;
            if let (Some(source), Some(target)) = (picture.rgba.get(from..from + 4), rgba.get_mut(to..to + 4)) {
                target.copy_from_slice(source);
            }
        }
    }
    Picture { width: out_width as u32, height: out_height as u32, rgba }
}

pub(super) fn turned_frame(position: (i32, i32), size: (u32, u32), turn: PinTurn) -> (i32, i32, u32, u32) {
    if !turn.swaps_sides() {
        return (position.0, position.1, size.0, size.1);
    }
    let center_x = f64::from(position.0) + f64::from(size.0) / 2.0;
    let center_y = f64::from(position.1) + f64::from(size.1) / 2.0;
    let (width, height) = (size.1, size.0);
    ((center_x - f64::from(width) / 2.0).round() as i32, (center_y - f64::from(height) / 2.0).round() as i32, width, height)
}

pub(super) fn collapsed_frame(position: (i32, i32), size: (u32, u32), side: u32) -> (i32, i32, u32, u32) {
    let side = side.min(size.0.max(1)).min(size.1.max(1)).max(1);
    (position.0, position.1, side, side)
}

pub(super) fn reserved_size(size: (u32, u32), extra: (u32, u32)) -> (u32, u32) {
    (size.0.max(extra.0), size.1 + extra.1)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn picture() -> Picture {
        let pixel = |value: u8| [value, value, value, 255];
        Picture { width: 3, height: 2, rgba: [1, 2, 3, 4, 5, 6].into_iter().flat_map(pixel).collect() }
    }

    fn values(picture: &Picture) -> Vec<u8> {
        picture.rgba.chunks(4).map(|pixel| pixel[0]).collect()
    }

    #[test]
    fn a_quarter_turn_swaps_the_sides_and_moves_the_pixels() {
        let right = turn_picture(&picture(), PinTurn::Right);
        assert_eq!((right.width, right.height), (2, 3));
        assert_eq!(values(&right), vec![4, 1, 5, 2, 6, 3]);
        let left = turn_picture(&picture(), PinTurn::Left);
        assert_eq!(values(&left), vec![3, 6, 2, 5, 1, 4]);
        assert_eq!(values(&turn_picture(&right, PinTurn::Left)), values(&picture()));
    }

    #[test]
    fn flips_mirror_in_place() {
        assert_eq!(values(&turn_picture(&picture(), PinTurn::FlipX)), vec![3, 2, 1, 6, 5, 4]);
        assert_eq!(values(&turn_picture(&picture(), PinTurn::FlipY)), vec![4, 5, 6, 1, 2, 3]);
    }

    #[test]
    fn a_turned_pin_keeps_its_centre_and_a_flipped_one_stays_put() {
        assert_eq!(turned_frame((100, 50), (300, 100), PinTurn::Right), (200, -50, 100, 300));
        assert_eq!(turned_frame((-1900, 200), (40, 20), PinTurn::Left), (-1890, 190, 20, 40), "monitors left of the main one have negative x");
        assert_eq!(turned_frame((100, 50), (300, 100), PinTurn::FlipX), (100, 50, 300, 100));
    }

    #[test]
    fn collapsing_keeps_the_corner_and_never_grows() {
        assert_eq!(collapsed_frame((10, 20), (300, 200), 64), (10, 20, 64, 64));
        assert_eq!(collapsed_frame((10, 20), (30, 200), 64), (10, 20, 30, 30));
    }

    #[test]
    fn the_editing_bar_widens_and_lengthens_the_window() {
        assert_eq!(reserved_size((100, 80), (400, 50)), (400, 130));
        assert_eq!(reserved_size((600, 80), (400, 50)), (600, 130));
    }
}
