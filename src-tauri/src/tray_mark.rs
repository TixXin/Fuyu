use tauri::image::Image;

pub(crate) const WIDTH: u32 = 48;
pub(crate) const HEIGHT: u32 = 36;
const PIXELS_PER_UNIT: f64 = 24.0 / 22.0;
const SAMPLES: u32 = 4;

fn segment_distance((x, y): (f64, f64), (ax, ay): (f64, f64), (bx, by): (f64, f64)) -> f64 {
    let (dx, dy) = (bx - ax, by - ay);
    let length = dx * dx + dy * dy;
    let t = if length == 0.0 { 0.0 } else { (((x - ax) * dx + (y - ay) * dy) / length).clamp(0.0, 1.0) };
    (x - (ax + t * dx)).hypot(y - (ay + t * dy))
}

fn inside(point: (f64, f64)) -> bool {
    segment_distance(point, (22.0, 32.0), (42.0, 32.0)) <= 11.0
        && segment_distance(point, (22.0, 32.0), (22.0, 32.0)) > 4.0
        && segment_distance(point, (33.0, 32.0), (43.0, 32.0)) > 2.0
}

fn to_units(pixel: u32, sample: u32, size: u32) -> f64 {
    let offset = f64::from(pixel) + (f64::from(sample) + 0.5) / f64::from(SAMPLES) - f64::from(size) / 2.0;
    32.0 + offset / PIXELS_PER_UNIT
}

pub(crate) fn alpha(px: u32, py: u32) -> u8 {
    let mut covered = 0;
    for sy in 0..SAMPLES {
        for sx in 0..SAMPLES {
            if inside((to_units(px, sx, WIDTH), to_units(py, sy, HEIGHT))) {
                covered += 1;
            }
        }
    }
    u8::try_from(covered * 255 / (SAMPLES * SAMPLES)).unwrap_or(u8::MAX)
}

pub(crate) fn image() -> Image<'static> {
    let mut rgba = Vec::with_capacity((WIDTH * HEIGHT * 4) as usize);
    for py in 0..HEIGHT {
        for px in 0..WIDTH {
            rgba.extend_from_slice(&[0, 0, 0, alpha(px, py)]);
        }
    }
    Image::new_owned(rgba, WIDTH, HEIGHT)
}

#[cfg(test)]
mod tests {
    use super::{alpha, image, HEIGHT, WIDTH};

    #[test]
    fn the_mark_is_a_solid_capsule_with_the_dot_and_dash_cut_out() {
        assert_eq!(alpha(0, 0), 0, "corners stay clear");
        assert_eq!(alpha(WIDTH - 1, HEIGHT / 2), 0, "the capsule stops short of the edge");
        assert_eq!(alpha(10, 12), 255, "the capsule body is solid");
        assert_eq!(alpha(12, HEIGHT / 2), 0, "the dot is a hole");
        assert_eq!(alpha(30, HEIGHT / 2), 0, "the dash is a hole");
        assert_eq!(alpha(38, 12), 255, "past the dash it is solid again");
        let mark = image();
        assert_eq!((mark.width(), mark.height()), (WIDTH, HEIGHT));
        assert!(mark.rgba().chunks(4).all(|pixel| pixel[..3] == [0, 0, 0]), "a template image is black, macOS tints it");
    }
}
