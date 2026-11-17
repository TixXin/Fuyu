use std::path::Path;
use windows::{
    core::HSTRING,
    Win32::{
        System::{
            Com::{CoCreateInstance, CLSCTX_ALL},
            Registry::{
                RegCloseKey, RegGetValueW, RegOpenKeyExW, HKEY, HKEY_CLASSES_ROOT,
                HKEY_CURRENT_USER, KEY_READ, RRF_RT_ANY,
            },
        },
        UI::Shell::{ApplicationActivationManager, IApplicationActivationManager, AO_NONE},
    },
};

const APP_USER_MODEL_IDS_KEY: &str = r"Software\Classes\AppUserModelId";
const SYSTEM_APP_DATA_KEY: &str =
    r"Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData";

pub(crate) fn activate_application(app_user_model_id: &str) -> Result<u32, String> {
    let trimmed = app_user_model_id.trim();
    if trimmed.is_empty() {
        return Err("Empty AppUserModelId.".into());
    }
    let _com = super::com::ComApartment::multithreaded()
        .map_err(|error| format!("Could not initialize COM: {error}"))?;
    let manager: IApplicationActivationManager =
        unsafe { CoCreateInstance(&ApplicationActivationManager, None, CLSCTX_ALL) }
            .map_err(|error| format!("Could not create ApplicationActivationManager: {error}"))?;
    let aumid = HSTRING::from(trimmed);
    let arguments = HSTRING::new();
    unsafe { manager.ActivateApplication(&aumid, &arguments, AO_NONE) }
        .map_err(|error| format!("ActivateApplication failed for {trimmed}: {error}"))
}

pub(crate) fn key_exists(root: HKEY, subkey: &str) -> bool {
    let subkey = HSTRING::from(subkey);
    let mut handle = HKEY::default();
    if unsafe { RegOpenKeyExW(root, &subkey, None, KEY_READ, &mut handle) }.is_err() {
        return false;
    }
    let _ = unsafe { RegCloseKey(handle) };
    true
}

pub(crate) fn value_exists(root: HKEY, subkey: &str, value: &str) -> bool {
    let subkey = HSTRING::from(subkey);
    let value = HSTRING::from(value);
    unsafe { RegGetValueW(root, &subkey, &value, RRF_RT_ANY, None, None, None) }.is_ok()
}

pub(crate) fn is_valid_scheme(scheme: &str) -> bool {
    let mut chars = scheme.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_alphabetic()
        && chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
}

pub(crate) fn extract_command_executable(command: &str) -> Option<&str> {
    let trimmed = command.trim();
    if let Some(quoted) = trimmed.strip_prefix('"') {
        let end = quoted.find('"')?;
        let candidate = quoted[..end].trim();
        return looks_like_windows_exe(candidate).then_some(candidate);
    }
    let end = trimmed
        .char_indices()
        .find(|(_, ch)| ch.is_whitespace())
        .map_or(trimmed.len(), |(idx, _)| idx);
    let candidate = trimmed[..end].trim();
    looks_like_windows_exe(candidate).then_some(candidate)
}

fn looks_like_windows_exe(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 7
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && matches!(bytes[2], b'\\' | b'/')
        && path[path.len() - 4..].eq_ignore_ascii_case(".exe")
}

pub(crate) fn is_url_protocol_registered(scheme: &str) -> bool {
    if !is_valid_scheme(scheme) {
        return false;
    }
    if value_exists(HKEY_CLASSES_ROOT, scheme, "URL Protocol") {
        let command_key = format!(r"{scheme}\shell\open\command");
        if let Some(command) = super::registry::read_string(HKEY_CLASSES_ROOT, &command_key, "") {
            let trimmed = command.trim();
            if !trimmed.is_empty() {
                if let Some(exe) = extract_command_executable(trimmed) {
                    return Path::new(exe).is_file();
                }
                return true;
            }
        }
        if key_exists(HKEY_CLASSES_ROOT, &format!(r"{scheme}\shell\open")) {
            return true;
        }
    }
    let choice_key =
        format!(r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\{scheme}\UserChoice");
    if let Some(prog_id) = super::registry::read_string(HKEY_CURRENT_USER, &choice_key, "ProgId") {
        let trimmed = prog_id.trim();
        if !trimmed.is_empty() && key_exists(HKEY_CLASSES_ROOT, trimmed) {
            return true;
        }
    }
    false
}

fn starts_with_ignore_ascii_case(text: &str, prefix: &str) -> bool {
    !prefix.is_empty()
        && text
            .get(..prefix.len())
            .is_some_and(|head| head.eq_ignore_ascii_case(prefix))
}

pub(crate) fn find_packaged_aumid(
    prefixes: &[&str],
    fallback_aumids: &[&str],
) -> Option<String> {
    if prefixes.is_empty() {
        return None;
    }
    for subkey in super::registry::subkey_names(HKEY_CURRENT_USER, APP_USER_MODEL_IDS_KEY) {
        if subkey.contains('!')
            && prefixes
                .iter()
                .any(|prefix| starts_with_ignore_ascii_case(&subkey, prefix))
        {
            return Some(subkey);
        }
    }
    for family in super::registry::subkey_names(HKEY_CURRENT_USER, SYSTEM_APP_DATA_KEY) {
        if prefixes
            .iter()
            .any(|prefix| starts_with_ignore_ascii_case(&family, prefix))
        {
            if let Some(known) = fallback_aumids
                .iter()
                .find(|candidate| starts_with_ignore_ascii_case(candidate, &family))
            {
                return Some((*known).to_string());
            }
            return Some(format!("{family}!App"));
        }
    }
    None
}

pub(crate) fn has_packaged_app(prefixes: &[&str]) -> bool {
    if prefixes.is_empty() {
        return false;
    }
    super::registry::subkey_names(HKEY_CURRENT_USER, SYSTEM_APP_DATA_KEY)
        .iter()
        .any(|family| {
            prefixes
                .iter()
                .any(|prefix| starts_with_ignore_ascii_case(family, prefix))
        })
        || super::registry::subkey_names(HKEY_CURRENT_USER, APP_USER_MODEL_IDS_KEY)
            .iter()
            .any(|aumid| {
                aumid.contains('!')
                    && prefixes
                        .iter()
                        .any(|prefix| starts_with_ignore_ascii_case(aumid, prefix))
            })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scheme_validation_and_command_exe_parsing() {
        assert!(is_valid_scheme("tg"));
        assert!(is_valid_scheme("ms-settings"));
        assert!(!is_valid_scheme(""));
        assert!(!is_valid_scheme("1bad"));
        assert!(!is_valid_scheme("tg://"));
        assert_eq!(
            extract_command_executable(r#""C:\Users\me\Telegram\Telegram.exe" -- "%1""#),
            Some(r"C:\Users\me\Telegram\Telegram.exe")
        );
        assert_eq!(
            extract_command_executable(r"D:\Apps\WXWork\WXWork.exe %1"),
            Some(r"D:\Apps\WXWork\WXWork.exe")
        );
        assert_eq!(extract_command_executable(r"rundll32.exe url.dll"), None);
    }

    #[test]
    fn uninstal_protocol_returns_false_and_standard_keys_exist() {
        assert!(!is_url_protocol_registered("fuyu-nonexistent-im-scheme-xyz"));
        assert!(key_exists(
            windows::Win32::System::Registry::HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows NT\CurrentVersion"
        ));
        assert!(!key_exists(
            HKEY_CURRENT_USER,
            r"Software\Fuyu\DefinitelyMissingKey"
        ));
    }
}
