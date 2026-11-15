use arboard::Clipboard;
#[cfg(target_os = "macos")]
use arboard::SetExtApple;
#[cfg(windows)]
use arboard::SetExtWindows;

use super::settings::InfoItem;

pub(super) fn copy(item: &InfoItem) -> Result<(), String> {
    let value = item
        .copyable_value()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "This info item cannot be copied.".to_string())?;
    let mut clipboard = Clipboard::new().map_err(|error| format!("Could not open the clipboard: {error}"))?;
    let set = clipboard.set();
    #[cfg(windows)]
    let set = if item.is_secret() { set.exclude_from_monitoring() } else { set };
    #[cfg(target_os = "macos")]
    let set = if item.is_secret() { set.exclude_from_history() } else { set };
    set.text(value.to_string())
        .map_err(|error| format!("Could not write the clipboard: {error}"))
}
