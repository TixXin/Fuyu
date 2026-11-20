use serde::Serialize;
use tauri::WebviewWindow;

use super::PixelRect;

const MAX_SIDE: u32 = 2000;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ScreenshotQrCode {
    pub text: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

fn shrink_factor(width: u32, height: u32) -> u32 {
    width.max(height).div_ceil(MAX_SIDE).max(1)
}

fn greyscale(width: u32, height: u32, rgba: &[u8], factor: u32) -> (usize, usize, Vec<u8>) {
    let out_width = (width / factor).max(1) as usize;
    let out_height = (height / factor).max(1) as usize;
    let mut grey = Vec::with_capacity(out_width * out_height);
    for row in 0..out_height {
        for column in 0..out_width {
            let index = ((row * factor as usize) * width as usize + column * factor as usize) * 4;
            let value = rgba.get(index..index + 3).map_or(255, |pixel| ((pixel[0] as u32 * 77 + pixel[1] as u32 * 150 + pixel[2] as u32 * 29) >> 8) as u8);
            grey.push(value);
        }
    }
    (out_width, out_height, grey)
}

pub(crate) fn read_codes(width: u32, height: u32, rgba: &[u8]) -> Vec<ScreenshotQrCode> {
    if width == 0 || height == 0 || rgba.len() < width as usize * height as usize * 4 {
        return Vec::new();
    }
    let factor = shrink_factor(width, height);
    let (grey_width, grey_height, grey) = greyscale(width, height, rgba, factor);
    let mut prepared = rqrr::PreparedImage::prepare_from_greyscale(grey_width, grey_height, |x, y| grey[y * grey_width + x]);
    let mut codes: Vec<ScreenshotQrCode> = Vec::new();
    for grid in prepared.detect_grids() {
        let Ok((_, text)) = grid.decode() else { continue };
        if text.is_empty() || codes.iter().any(|code| code.text == text) {
            continue;
        }
        let xs = grid.bounds.iter().map(|point| point.x.max(0) as u32);
        let ys = grid.bounds.iter().map(|point| point.y.max(0) as u32);
        let (left, right) = (xs.clone().min().unwrap_or(0), xs.max().unwrap_or(0));
        let (top, bottom) = (ys.clone().min().unwrap_or(0), ys.max().unwrap_or(0));
        codes.push(ScreenshotQrCode {
            text,
            x: left * factor,
            y: top * factor,
            width: (right - left) * factor,
            height: (bottom - top) * factor,
        });
    }
    codes
}

#[tauri::command]
pub async fn screenshot_read_qr(window: WebviewWindow, x: u32, y: u32, width: u32, height: u32) -> Result<Vec<ScreenshotQrCode>, String> {
    super::wait_for_capture().await;
    let (cut_width, cut_height, rgba) = super::session::selection(window.label(), PixelRect { x, y, width, height }).ok_or_else(|| "Nothing is selected.".to_string())?;
    let codes = tauri::async_runtime::spawn_blocking(move || read_codes(cut_width, cut_height, &rgba))
        .await
        .map_err(|error| format!("Failed to read the QR code: {error}"))?;
    Ok(codes.into_iter().map(|code| ScreenshotQrCode { x: code.x + x, y: code.y + y, ..code }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(bytes: &[u8]) -> (u32, u32, Vec<u8>) {
        let picture = image::load_from_memory(bytes).unwrap().to_rgba8();
        (picture.width(), picture.height(), picture.into_raw())
    }

    fn texts(bytes: &[u8]) -> Vec<String> {
        let (width, height, rgba) = sample(bytes);
        read_codes(width, height, &rgba).into_iter().map(|code| code.text).collect()
    }

    #[test]
    fn a_link_beside_other_content_is_found_where_it_is() {
        let (width, height, rgba) = sample(include_bytes!("qr_samples/url.png"));
        let codes = read_codes(width, height, &rgba);
        assert_eq!(codes.len(), 1);
        assert_eq!(codes[0].text, "https://github.com/TixXin/fuyu");
        assert!(codes[0].x >= 190 && codes[0].x < 230 && codes[0].y >= 30 && codes[0].y < 70, "{:?}", codes[0]);
        assert!(codes[0].width > 80 && codes[0].height > 80, "{:?}", codes[0]);
    }

    #[test]
    fn chinese_text_comes_back_as_written() {
        assert_eq!(texts(include_bytes!("qr_samples/text.png")), vec!["浮屿 Fuyu：截图里的二维码".to_string()]);
    }

    #[test]
    fn a_contact_card_with_a_logo_in_the_middle_still_reads() {
        assert_eq!(texts(include_bytes!("qr_samples/card.png")), vec!["https://u.wechat.com/MExampleCardCode0123456789".to_string()]);
    }

    #[test]
    fn a_picture_without_a_code_gives_nothing() {
        assert!(texts(include_bytes!("qr_samples/none.png")).is_empty());
    }

    #[test]
    fn a_huge_selection_is_scanned_smaller_and_the_spot_is_scaled_back() {
        let (width, height, rgba) = sample(include_bytes!("qr_samples/url.png"));
        let (big_width, big_height) = (width * 6, height * 6);
        let mut big = vec![0u8; (big_width * big_height * 4) as usize];
        for row in 0..big_height {
            for column in 0..big_width {
                let from = (((row / 6) * width + column / 6) * 4) as usize;
                let to = ((row * big_width + column) * 4) as usize;
                big[to..to + 4].copy_from_slice(&rgba[from..from + 4]);
            }
        }
        assert_eq!(shrink_factor(big_width, big_height), 2);
        let codes = read_codes(big_width, big_height, &big);
        assert_eq!(codes.len(), 1);
        assert!(codes[0].x >= 190 * 6 && codes[0].x < 230 * 6, "{:?}", codes[0]);
    }

    #[test]
    fn short_or_empty_buffers_are_ignored() {
        assert!(read_codes(10, 10, &[0; 12]).is_empty());
        assert!(read_codes(0, 0, &[]).is_empty());
    }
}
