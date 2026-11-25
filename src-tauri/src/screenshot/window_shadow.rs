use super::output::Picture;

const CORNER_RADIUS_BASE: f32 = 10.0;
const PAD_X_BASE: f32 = 28.0;
const PAD_TOP_BASE: f32 = 18.0;
const PAD_BOTTOM_BASE: f32 = 38.0;
const SHADOW_OFFSET_Y_BASE: f32 = 10.0;
const KEY_RADIUS_BASE: f32 = 14.0;
const AMBIENT_RADIUS_BASE: f32 = 4.0;
const KEY_ALPHA: f32 = 0.34;
const AMBIENT_ALPHA: f32 = 0.14;

pub(super) fn add_shadow(picture: &Picture, scale: f64) -> Picture {
    if picture.width == 0 || picture.height == 0 || picture.rgba.len() < picture.width as usize * picture.height as usize * 4 {
        return Picture { width: picture.width, height: picture.height, rgba: picture.rgba.clone() };
    }
    let s = if scale.is_finite() && scale > 0.0 { scale.clamp(0.5, 4.0) as f32 } else { 1.0 };
    let pad_x = (PAD_X_BASE * s).round().max(4.0) as u32;
    let pad_top = (PAD_TOP_BASE * s).round().max(4.0) as u32;
    let pad_bottom = (PAD_BOTTOM_BASE * s).round().max(4.0) as u32;
    let radius = (CORNER_RADIUS_BASE * s).min(picture.width as f32 / 2.0).min(picture.height as f32 / 2.0);
    let out_w = picture.width.saturating_add(pad_x * 2);
    let out_h = picture.height.saturating_add(pad_top).saturating_add(pad_bottom);
    let w = out_w as usize;
    let h = out_h as usize;

    let mask = rounded_mask(picture.width as usize, picture.height as usize, radius);
    let y_off = (SHADOW_OFFSET_Y_BASE * s).round() as usize;
    let mut key = vec![0.0f32; w * h];
    let mut ambient = vec![0.0f32; w * h];
    for sy in 0..picture.height as usize {
        let row_src = sy * picture.width as usize;
        let dy_key = (pad_top as usize + sy + y_off).min(h - 1);
        let dy_amb = (pad_top as usize + sy + (y_off / 4)).min(h - 1);
        let dst_key = dy_key * w + pad_x as usize;
        let dst_amb = dy_amb * w + pad_x as usize;
        for sx in 0..picture.width as usize {
            let m = mask[row_src + sx];
            key[dst_key + sx] = m;
            ambient[dst_amb + sx] = m;
        }
    }

    let key_r = (KEY_RADIUS_BASE * s).round().max(1.0) as usize;
    let amb_r = (AMBIENT_RADIUS_BASE * s).round().max(1.0) as usize;
    box_blur_3(&mut key, w, h, key_r);
    box_blur_3(&mut ambient, w, h, amb_r);

    let mut rgba = vec![0u8; w * h * 4];
    for i in 0..w * h {
        let a_key = (key[i] * KEY_ALPHA).clamp(0.0, 1.0);
        let a_amb = (ambient[i] * AMBIENT_ALPHA).clamp(0.0, 1.0);
        let alpha = (1.0 - (1.0 - a_key) * (1.0 - a_amb)).clamp(0.0, 1.0);
        rgba[i * 4 + 3] = (alpha * 255.0).round() as u8;
    }

    let src_w = picture.width as usize;
    let src_h = picture.height as usize;
    for sy in 0..src_h {
        let dy = pad_top as usize + sy;
        for sx in 0..src_w {
            let coverage = mask[sy * src_w + sx];
            if coverage <= 0.0 {
                continue;
            }
            let src_i = (sy * src_w + sx) * 4;
            let dst_i = (dy * w + pad_x as usize + sx) * 4;
            let sr = f32::from(picture.rgba[src_i]);
            let sg = f32::from(picture.rgba[src_i + 1]);
            let sb = f32::from(picture.rgba[src_i + 2]);
            let sa = (f32::from(picture.rgba[src_i + 3]) / 255.0) * coverage;
            let da = f32::from(rgba[dst_i + 3]) / 255.0;
            let out_a = sa + da * (1.0 - sa);
            if out_a > 0.0 {
                let factor = sa / out_a;
                rgba[dst_i] = (sr * factor).round().clamp(0.0, 255.0) as u8;
                rgba[dst_i + 1] = (sg * factor).round().clamp(0.0, 255.0) as u8;
                rgba[dst_i + 2] = (sb * factor).round().clamp(0.0, 255.0) as u8;
                rgba[dst_i + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
            }
        }
    }

    Picture { width: out_w, height: out_h, rgba }
}

fn rounded_mask(width: usize, height: usize, radius: f32) -> Vec<f32> {
    let mut mask = vec![1.0f32; width * height];
    if radius <= 0.5 {
        return mask;
    }
    let w = width as f32;
    let h = height as f32;
    let cx = w / 2.0;
    let cy = h / 2.0;
    let hx = cx - radius;
    let hy = cy - radius;
    let band = radius.ceil() as usize + 2;
    for y in 0..height {
        if y >= band && y + band < height {
            continue;
        }
        let py = (y as f32 + 0.5 - cy).abs();
        for x in 0..width {
            if x >= band && x + band < width {
                continue;
            }
            let px = (x as f32 + 0.5 - cx).abs();
            let qx = (px - hx).max(0.0);
            let qy = (py - hy).max(0.0);
            let dist = (qx * qx + qy * qy).sqrt() - radius;
            mask[y * width + x] = (0.5 - dist).clamp(0.0, 1.0);
        }
    }
    mask
}

fn box_blur_3(data: &mut [f32], width: usize, height: usize, radius: usize) {
    if radius == 0 || width == 0 || height == 0 {
        return;
    }
    let mut scratch = vec![0.0f32; width * height];
    for _ in 0..3 {
        box_blur_h(data, &mut scratch, width, height, radius);
        box_blur_v(&scratch, data, width, height, radius);
    }
}

fn box_blur_h(src: &[f32], dst: &mut [f32], width: usize, height: usize, radius: usize) {
    let span = (radius * 2 + 1) as f32;
    for y in 0..height {
        let row = y * width;
        let mut sum = src[row] * (radius as f32 + 1.0);
        for k in 1..=radius {
            sum += src[row + k.min(width - 1)];
        }
        for x in 0..width {
            dst[row + x] = sum / span;
            let add_x = (x + radius + 1).min(width - 1);
            let sub_x = x.saturating_sub(radius);
            sum += src[row + add_x] - src[row + sub_x];
        }
    }
}

fn box_blur_v(src: &[f32], dst: &mut [f32], width: usize, height: usize, radius: usize) {
    let span = (radius * 2 + 1) as f32;
    for x in 0..width {
        let mut sum = src[x] * (radius as f32 + 1.0);
        for k in 1..=radius {
            sum += src[k.min(height - 1) * width + x];
        }
        for y in 0..height {
            dst[y * width + x] = sum / span;
            let add_y = (y + radius + 1).min(height - 1);
            let sub_y = y.saturating_sub(radius);
            sum += src[add_y * width + x] - src[sub_y * width + x];
        }
    }
}

#[cfg(any(target_os = "macos", test))]
pub(crate) fn unpremultiply_bgra_to_rgba(bytes: &[u8], width: usize, height: usize, row_bytes: usize) -> Option<Vec<u8>> {
    if width == 0 || height == 0 || row_bytes < width * 4 || bytes.len() < row_bytes * height {
        return None;
    }
    let mut rgba = vec![0u8; width * height * 4];
    for (out, line) in rgba.chunks_exact_mut(width * 4).zip(bytes.chunks_exact(row_bytes)) {
        for (pixel, &[blue, green, red, alpha]) in out.as_chunks_mut::<4>().0.iter_mut().zip(line[..width * 4].as_chunks::<4>().0) {
            if alpha == 0 {
                *pixel = [0, 0, 0, 0];
            } else if alpha == 255 {
                *pixel = [red, green, blue, 255];
            } else {
                let a = u16::from(alpha);
                let un = |c: u8| ((u16::from(c) * 255 + a / 2) / a).min(255) as u8;
                *pixel = [un(red), un(green), un(blue), alpha];
            }
        }
    }
    Some(rgba)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shadow_adds_padding_transparent_corners_and_preserves_interior() {
        let width = 80;
        let height = 60;
        let mut src = vec![0u8; (width * height * 4) as usize];
        for px in src.as_chunks_mut::<4>().0 {
            *px = [200, 120, 60, 255];
        }
        let out = add_shadow(&Picture { width, height, rgba: src }, 1.0);
        assert!(out.width > width && out.height > height);
        assert_eq!(out.rgba[3], 0);
        let top_right = (out.width as usize - 1) * 4;
        assert_eq!(out.rgba[top_right + 3], 0);
        let center_x = out.width as usize / 2;
        let center_y = 18 + (height as usize / 2);
        let center = (center_y * out.width as usize + center_x) * 4;
        assert_eq!(&out.rgba[center..center + 4], &[200, 120, 60, 255]);
        let below_y = 18 + height as usize + 6;
        let below = (below_y * out.width as usize + center_x) * 4;
        assert!(out.rgba[below + 3] > 10 && out.rgba[below + 3] < 200);
        let corner_y = 18;
        let corner_x = 28;
        let corner = (corner_y * out.width as usize + corner_x) * 4;
        assert!(out.rgba[corner + 3] < 200);
    }

    #[test]
    fn unpremultiply_restores_straight_rgba_and_clears_zero_alpha() {
        let bgra = [50, 100, 128, 128, 9, 8, 7, 0, 10, 20, 30, 255];
        let rgba = unpremultiply_bgra_to_rgba(&bgra, 3, 1, 12).expect("valid");
        assert_eq!(&rgba[0..4], &[255, 199, 100, 128]);
        assert_eq!(&rgba[4..8], &[0, 0, 0, 0]);
        assert_eq!(&rgba[8..12], &[30, 20, 10, 255]);
    }
}
