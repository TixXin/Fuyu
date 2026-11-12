use windows::{
    core::HSTRING,
    Win32::System::Registry::{RegSetKeyValueW, HKEY_CURRENT_USER, REG_SZ},
};

use super::registry::read_string;

pub(crate) fn register(scheme: &str, description: &str, command: &str) -> Result<(), String> {
    let key = format!(r"Software\Classes\{scheme}");
    let command_key = format!(r"{key}\shell\open\command");
    if read_string(HKEY_CURRENT_USER, &command_key, "").as_deref() == Some(command) {
        return Ok(());
    }
    write(&key, "", &format!("URL:{description}"))?;
    write(&key, "URL Protocol", "")?;
    write(&command_key, "", command)
}

fn write(subkey: &str, name: &str, data: &str) -> Result<(), String> {
    let wide: Vec<u16> = data.encode_utf16().chain(Some(0)).collect();
    let (subkey_text, name_text) = (HSTRING::from(subkey), HSTRING::from(name));
    let result = unsafe {
        RegSetKeyValueW(
            HKEY_CURRENT_USER,
            &subkey_text,
            &name_text,
            REG_SZ.0,
            Some(wide.as_ptr().cast()),
            (wide.len() * 2) as u32,
        )
    };
    result.ok().map_err(|error| format!(r"Could not write HKCU\{subkey}: {error}"))
}
