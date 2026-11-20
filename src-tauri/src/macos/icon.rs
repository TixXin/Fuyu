use image::{imageops::FilterType, ImageFormat};
use objc2::rc::{autoreleasepool, Retained};
use objc2::AllocAnyThread;
use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSWorkspace};
use objc2_foundation::{NSDictionary, NSPoint, NSRect, NSSize, NSString};

const APP_ICON_SIDE: u32 = 64;
const DRAG_ICON_POINTS: f64 = 32.0;

pub(crate) struct IconPixels {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) rgba: Vec<u8>,
}

fn icon_bitmap(path: &str, pixels: f64) -> Option<Retained<NSBitmapImageRep>> {
    let icon = NSWorkspace::sharedWorkspace().iconForFile(&NSString::from_str(path));
    let mut rect = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(pixels, pixels));
    let image = unsafe { icon.CGImageForProposedRect_context_hints(&mut rect, None, None) }?;
    Some(NSBitmapImageRep::initWithCGImage(NSBitmapImageRep::alloc(), &image))
}

pub(crate) fn exe_icon(path: &str) -> Option<IconPixels> {
    let png = autoreleasepool(|_| {
        let bitmap = icon_bitmap(path, f64::from(APP_ICON_SIDE))?;
        let png = unsafe { bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) }?;
        Some(png.to_vec())
    })?;
    let mut image = image::load_from_memory_with_format(&png, ImageFormat::Png).ok()?.to_rgba8();
    if (image.width(), image.height()) != (APP_ICON_SIDE, APP_ICON_SIDE) {
        image = image::imageops::resize(&image, APP_ICON_SIDE, APP_ICON_SIDE, FilterType::Lanczos3);
    }
    Some(IconPixels { width: image.width(), height: image.height(), rgba: image.into_raw() })
}

pub(crate) fn file_icon_tiff(path: &str) -> Option<Vec<u8>> {
    autoreleasepool(|_| {
        let bitmap = icon_bitmap(path, DRAG_ICON_POINTS * 2.0)?;
        bitmap.setSize(NSSize::new(DRAG_ICON_POINTS, DRAG_ICON_POINTS));
        let bytes = bitmap.TIFFRepresentation()?.to_vec();
        (!bytes.is_empty()).then_some(bytes)
    })
}

#[cfg(test)]
mod tests {
    use super::{exe_icon, file_icon_tiff};

    #[test]
    fn any_file_has_a_finder_icon() {
        let bytes = file_icon_tiff("/System/Applications/Calculator.app").unwrap_or_default();
        assert!(bytes.starts_with(b"MM") || bytes.starts_with(b"II"), "TIFF header");
        assert!(bytes.len() < 256 * 1024, "only the drag-sized picture, not every icon size");
    }

    #[test]
    fn an_app_bundle_gives_a_square_icon() {
        let icon = exe_icon("/System/Applications/Calculator.app").expect("Calculator has an icon");
        assert_eq!((icon.width, icon.height), (64, 64));
        assert_eq!(icon.rgba.len(), 64 * 64 * 4);
    }
}
