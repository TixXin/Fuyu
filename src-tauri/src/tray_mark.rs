use tauri::image::Image;

pub(crate) const WIDTH: u32 = 52;
pub(crate) const HEIGHT: u32 = 36;
const VIEW_X: f64 = 3.0;
const VIEW_Y: f64 = 6.0;
const VIEW_WIDTH: f64 = 58.0;
const VIEW_HEIGHT: f64 = 40.5;
const SAMPLES: u32 = 4;
const CURVE_STEPS: u32 = 24;
const LOBES: [f64; 4] = [18.0, 27.3, 36.7, 46.0];
const LOBE_Y: f64 = 39.0;
const LOBE_RADIUS: f64 = 6.6;
const EYES: [f64; 2] = [24.0, 40.0];
const EYE_Y: f64 = 24.6;
const EYE_RX: f64 = 3.6;
const EYE_RY: f64 = 5.0;

type Point = (f64, f64);

fn cubic(points: &mut Vec<Point>, p0: Point, p1: Point, p2: Point, p3: Point) {
    for step in 1..=CURVE_STEPS {
        let t = f64::from(step) / f64::from(CURVE_STEPS);
        let u = 1.0 - t;
        let (a, b, c, d) = (u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t);
        points.push((
            a * p0.0 + b * p1.0 + c * p2.0 + d * p3.0,
            a * p0.1 + b * p1.1 + c * p2.1 + d * p3.1,
        ));
    }
}

fn bell() -> Vec<Point> {
    let mut points = vec![(5.0, 30.5)];
    cubic(&mut points, (5.0, 30.5), (5.0, 16.0), (17.0, 7.0), (32.0, 7.0));
    cubic(&mut points, (32.0, 7.0), (47.0, 7.0), (59.0, 16.0), (59.0, 30.5));
    cubic(&mut points, (59.0, 30.5), (59.0, 33.5), (56.6, 36.0), (53.6, 36.0));
    points.push((10.4, 36.0));
    cubic(&mut points, (10.4, 36.0), (7.4, 36.0), (5.0, 33.5), (5.0, 30.5));
    points
}

fn in_polygon((x, y): Point, polygon: &[Point]) -> bool {
    let Some(&last) = polygon.last() else {
        return false;
    };
    let mut inside = false;
    let mut previous = last;
    for &(px, py) in polygon {
        let (qx, qy) = previous;
        if (py > y) != (qy > y) && x < (qx - px) * (y - py) / (qy - py) + px {
            inside = !inside;
        }
        previous = (px, py);
    }
    inside
}

fn inside(point: Point, bell: &[Point]) -> bool {
    let (x, y) = point;
    let body = in_polygon(point, bell) || LOBES.iter().any(|&cx| (x - cx).hypot(y - LOBE_Y) <= LOBE_RADIUS);
    let eye = EYES.iter().any(|&cx| ((x - cx) / EYE_RX).powi(2) + ((y - EYE_Y) / EYE_RY).powi(2) <= 1.0);
    body && !eye
}

fn scale() -> f64 {
    f64::from(HEIGHT) / VIEW_HEIGHT
}

fn x_offset() -> f64 {
    (f64::from(WIDTH) - VIEW_WIDTH * scale()) / 2.0
}

fn sample_to_units(pixel: u32, sample: u32) -> f64 {
    f64::from(pixel) + (f64::from(sample) + 0.5) / f64::from(SAMPLES)
}

pub(crate) fn alpha(bell: &[Point], px: u32, py: u32) -> u8 {
    let mut covered = 0;
    for sy in 0..SAMPLES {
        for sx in 0..SAMPLES {
            let x = VIEW_X + (sample_to_units(px, sx) - x_offset()) / scale();
            let y = VIEW_Y + sample_to_units(py, sy) / scale();
            if inside((x, y), bell) {
                covered += 1;
            }
        }
    }
    u8::try_from(covered * 255 / (SAMPLES * SAMPLES)).unwrap_or(u8::MAX)
}

pub(crate) fn image() -> Image<'static> {
    let bell = bell();
    let mut rgba = Vec::with_capacity((WIDTH * HEIGHT * 4) as usize);
    for py in 0..HEIGHT {
        for px in 0..WIDTH {
            rgba.extend_from_slice(&[0, 0, 0, alpha(&bell, px, py)]);
        }
    }
    Image::new_owned(rgba, WIDTH, HEIGHT)
}

pub(crate) fn from_alpha(alpha: &[u8]) -> Option<Image<'static>> {
    if alpha.len() != (WIDTH * HEIGHT) as usize {
        return None;
    }
    let mut rgba = Vec::with_capacity(alpha.len() * 4);
    for &value in alpha {
        rgba.extend_from_slice(&[0, 0, 0, value]);
    }
    Some(Image::new_owned(rgba, WIDTH, HEIGHT))
}

#[cfg(test)]
mod tests {
    use super::{alpha, bell, from_alpha, image, scale, x_offset, HEIGHT, VIEW_X, VIEW_Y, WIDTH};

    fn at(x: f64, y: f64) -> u8 {
        let px = ((x - VIEW_X) * scale() + x_offset()).floor() as u32;
        let py = ((y - VIEW_Y) * scale()).floor() as u32;
        alpha(&bell(), px, py)
    }

    #[test]
    fn the_mark_is_a_solid_jellyfish_with_the_eyes_cut_out() {
        let bell = bell();
        assert_eq!(alpha(&bell, 0, 0), 0, "corners stay clear");
        assert_eq!(alpha(&bell, WIDTH - 1, 0), 0, "corners stay clear");
        assert_eq!(at(32.0, 12.0), 255, "the top of the bell is solid");
        assert_eq!(at(10.0, 31.0), 255, "the rim of the bell is solid");
        assert_eq!(at(24.0, 24.6), 0, "the left eye is a hole");
        assert_eq!(at(40.0, 24.6), 0, "the right eye is a hole");
        assert_eq!(at(32.0, 26.0), 255, "between the eyes it is solid");
        assert_eq!(at(18.0, 44.0), 255, "a lobe reaches below the bell");
        assert_eq!(at(22.65, 45.6), 0, "the lobes leave notches between them");
        let mark = image();
        assert_eq!((mark.width(), mark.height()), (WIDTH, HEIGHT));
        assert!(mark.rgba().chunks(4).all(|pixel| pixel[..3] == [0, 0, 0]), "a template image is black, macOS tints it");
    }
    #[test]
    fn a_drawn_mark_keeps_its_alpha_and_is_refused_at_any_other_size() {
        let mut drawn = vec![0u8; (WIDTH * HEIGHT) as usize];
        drawn[5] = 255;
        drawn[6] = 41;
        let mark = from_alpha(&drawn).expect("a full-size mark is accepted");
        assert_eq!((mark.width(), mark.height()), (WIDTH, HEIGHT));
        assert_eq!(&mark.rgba()[20..28], &[0, 0, 0, 255, 0, 0, 0, 41]);
        assert!(from_alpha(&drawn[1..]).is_none());
        assert!(from_alpha(&[]).is_none());
    }
}
