use std::{io::Cursor, path::Path};

use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, ImageFormat, ImageReader, RgbaImage};

use super::{store::make_thumbnail, ClipboardFileImage, ClipboardHistoryItem, ClipboardHistoryItemKind};

const IMAGE_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
const MAX_FILE_BYTES: u64 = 40 * 1024 * 1024;
pub(super) const BACKFILL_LIMIT: usize = 60;

pub(super) fn is_image_file(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| IMAGE_EXTENSIONS.iter().any(|known| extension.eq_ignore_ascii_case(known)))
}

pub(super) fn single_image_file(item: &ClipboardHistoryItem) -> Option<&str> {
    if item.kind != ClipboardHistoryItemKind::Files || item.file_image.is_some() {
        return None;
    }
    match item.files.as_deref() {
        Some([path]) if is_image_file(path) => Some(path.as_str()),
        _ => None,
    }
}

pub(super) fn read(path: &str) -> Option<ClipboardFileImage> {
    let byte_size = std::fs::metadata(path).ok().filter(|meta| meta.is_file())?.len();
    if byte_size > MAX_FILE_BYTES {
        return None;
    }
    let image = ImageReader::open(path).ok()?.with_guessed_format().ok()?.decode().ok()?.to_rgba8();
    describe(&image, byte_size)
}

pub(super) fn from_pixels(path: &str, width: usize, height: usize, rgba: Vec<u8>) -> Option<ClipboardFileImage> {
    let image = RgbaImage::from_raw(u32::try_from(width).ok()?, u32::try_from(height).ok()?, rgba)?;
    let byte_size = std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0);
    describe(&image, byte_size)
}

fn describe(image: &RgbaImage, byte_size: u64) -> Option<ClipboardFileImage> {
    let thumbnail = make_thumbnail(image);
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(thumbnail).write_to(&mut bytes, ImageFormat::Png).ok()?;
    Some(ClipboardFileImage {
        width: image.width(),
        height: image.height(),
        byte_size,
        thumbnail_data_url: format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(bytes.into_inner())),
    })
}

#[cfg(test)]
mod tests {
    use super::{is_image_file, read};

    #[test]
    fn image_files_are_known_by_extension() {
        assert!(is_image_file("/Users/me/Downloads/PixPin_2026.JPG"));
        assert!(is_image_file(r"C:\shots\a.webp"));
        assert!(!is_image_file("/Users/me/notes.txt"));
        assert!(!is_image_file("/Users/me/folder"));
    }

    #[test]
    fn a_copied_png_gets_its_size_and_a_thumbnail() {
        let dir = std::env::temp_dir().join(format!("fuyu-file-image-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let path = dir.join("wide.png");
        image::RgbaImage::from_pixel(400, 200, image::Rgba([10, 20, 30, 255])).save(&path).expect("write png");
        let found = read(&path.to_string_lossy()).expect("thumbnail");
        assert_eq!((found.width, found.height), (400, 200));
        assert!(found.thumbnail_data_url.starts_with("data:image/png;base64,"));
        assert!(read(&dir.join("missing.png").to_string_lossy()).is_none());
        let pasted = super::from_pixels(&dir.join("locked.jpg").to_string_lossy(), 2, 1, vec![0; 8]).expect("pixels");
        assert_eq!((pasted.width, pasted.height, pasted.byte_size), (2, 1, 0));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
