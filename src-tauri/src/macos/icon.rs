use objc2_app_kit::NSWorkspace;
use objc2_foundation::NSString;

pub(crate) struct IconPixels {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) rgba: Vec<u8>,
}

pub(crate) fn exe_icon(_path: &str) -> Option<IconPixels> {
    None
}

pub(crate) fn file_icon_tiff(path: &str) -> Option<Vec<u8>> {
    let icon = NSWorkspace::sharedWorkspace().iconForFile(&NSString::from_str(path));
    let data = icon.TIFFRepresentation()?;
    let bytes = data.to_vec();
    (!bytes.is_empty()).then_some(bytes)
}

#[cfg(test)]
mod tests {
    use super::file_icon_tiff;

    #[test]
    fn any_file_has_a_finder_icon() {
        let bytes = file_icon_tiff("/System/Applications/Calculator.app").unwrap_or_default();
        assert!(bytes.starts_with(b"MM") || bytes.starts_with(b"II"), "TIFF header");
    }
}
