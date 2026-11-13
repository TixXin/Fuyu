use image::{imageops::FilterType, ImageFormat};
use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSWorkspace};
use objc2_foundation::{NSDictionary, NSString};

const APP_ICON_SIDE: u32 = 64;

pub(crate) struct IconPixels {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) rgba: Vec<u8>,
}

pub(crate) fn exe_icon(path: &str) -> Option<IconPixels> {
    let tiff = NSWorkspace::sharedWorkspace().iconForFile(&NSString::from_str(path)).TIFFRepresentation()?;
    let bitmap = NSBitmapImageRep::imageRepWithData(&tiff)?;
    let png = unsafe { bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) }?;
    let image = image::load_from_memory_with_format(&png.to_vec(), ImageFormat::Png).ok()?.to_rgba8();
    let image = image::imageops::resize(&image, APP_ICON_SIDE, APP_ICON_SIDE, FilterType::Lanczos3);
    Some(IconPixels { width: image.width(), height: image.height(), rgba: image.into_raw() })
}

pub(crate) fn file_icon_tiff(path: &str) -> Option<Vec<u8>> {
    let icon = NSWorkspace::sharedWorkspace().iconForFile(&NSString::from_str(path));
    let data = icon.TIFFRepresentation()?;
    let bytes = data.to_vec();
    (!bytes.is_empty()).then_some(bytes)
}

#[cfg(test)]
mod tests {
    use super::{exe_icon, file_icon_tiff};

    #[test]
    fn any_file_has_a_finder_icon() {
        let bytes = file_icon_tiff("/System/Applications/Calculator.app").unwrap_or_default();
        assert!(bytes.starts_with(b"MM") || bytes.starts_with(b"II"), "TIFF header");
    }

    #[test]
    fn an_app_bundle_gives_a_square_icon() {
        let icon = exe_icon("/System/Applications/Calculator.app").expect("Calculator has an icon");
        assert_eq!((icon.width, icon.height), (64, 64));
        assert_eq!(icon.rgba.len(), 64 * 64 * 4);
    }
}
