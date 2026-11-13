use crate::macos::{apps, pasteboard};

pub(super) fn is_marked_private() -> bool {
    pasteboard::types().iter().any(|kind| pasteboard::is_private_type(kind))
}

pub(super) fn source_app_path() -> Option<String> {
    apps::frontmost_path()
}

pub(super) fn recognize_text(width: u32, height: u32, rgba: &[u8]) -> Option<String> {
    crate::macos::ocr::recognize(width, height, rgba)
}

pub(super) fn to_simplified(text: &str) -> Option<String> {
    pasteboard::transform(text, "Hant-Hans")
}

pub(super) fn to_traditional(text: &str) -> Option<String> {
    pasteboard::transform(text, "Hans-Hant")
}

#[cfg(test)]
mod tests {
    use super::{to_simplified, to_traditional};

    #[test]
    fn chinese_converts_between_scripts() {
        assert_eq!(to_simplified("剪貼簿歷史").as_deref(), Some("剪贴簿历史"));
        assert_eq!(to_traditional("剪贴板历史").as_deref(), Some("剪貼板歷史"));
    }
}
