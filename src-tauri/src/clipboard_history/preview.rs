use std::path::Path;

use base64::{engine::general_purpose, Engine as _};

use super::store::encode_png;

const PREVIEW_MAX_SIDE: u32 = 720;

pub(super) fn image_data_url(path: &Path) -> Result<String, String> {
    let image = image::open(path)
        .map_err(|error| format!("Failed to read the clipboard image: {error}"))?
        .to_rgba8();
    let longest = image.width().max(image.height()).max(1);
    let image = if longest > PREVIEW_MAX_SIDE {
        let scale = PREVIEW_MAX_SIDE as f32 / longest as f32;
        let width = ((image.width() as f32 * scale).round() as u32).max(1);
        let height = ((image.height() as f32 * scale).round() as u32).max(1);
        image::imageops::resize(&image, width, height, image::imageops::FilterType::Triangle)
    } else {
        image
    };
    Ok(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(encode_png(&image)?)))
}
