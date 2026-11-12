use windows::{
    core::{HSTRING, PWSTR},
    Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegGetValueW, RegOpenKeyExW, HKEY, KEY_ENUMERATE_SUB_KEYS, RRF_RT_REG_DWORD,
        RRF_RT_REG_QWORD, RRF_RT_REG_SZ,
    },
};

const MAX_STRING_UNITS: usize = 2048;

pub(crate) fn read_string(root: HKEY, subkey: &str, value: &str) -> Option<String> {
    let subkey = HSTRING::from(subkey);
    let value = HSTRING::from(value);
    let mut data = [0u16; MAX_STRING_UNITS];
    let mut bytes = (data.len() * 2) as u32;
    let result = unsafe {
        RegGetValueW(
            root,
            &subkey,
            &value,
            RRF_RT_REG_SZ,
            None,
            Some(data.as_mut_ptr().cast()),
            Some(&mut bytes),
        )
    };
    if result.is_err() {
        return None;
    }
    let length = data
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(data.len());
    Some(String::from_utf16_lossy(&data[..length]))
}

pub(crate) fn read_u32(root: HKEY, subkey: &str, value: &str) -> Option<u32> {
    let subkey = HSTRING::from(subkey);
    let value = HSTRING::from(value);
    let mut data = 0u32;
    let mut bytes = std::mem::size_of::<u32>() as u32;
    let result = unsafe {
        RegGetValueW(root, &subkey, &value, RRF_RT_REG_DWORD, None, Some((&raw mut data).cast()), Some(&mut bytes))
    };
    result.is_ok().then_some(data)
}

pub(crate) fn read_u64(root: HKEY, subkey: &str, value: &str) -> Option<u64> {
    let subkey = HSTRING::from(subkey);
    let value = HSTRING::from(value);
    let mut data = 0u64;
    let mut bytes = std::mem::size_of::<u64>() as u32;
    let result = unsafe {
        RegGetValueW(root, &subkey, &value, RRF_RT_REG_QWORD, None, Some((&raw mut data).cast()), Some(&mut bytes))
    };
    result.is_ok().then_some(data)
}

pub(crate) fn subkey_names(root: HKEY, subkey: &str) -> Vec<String> {
    let subkey = HSTRING::from(subkey);
    let mut key = HKEY::default();
    if unsafe { RegOpenKeyExW(root, &subkey, None, KEY_ENUMERATE_SUB_KEYS, &mut key) }.is_err() {
        return Vec::new();
    }
    let mut names = Vec::new();
    let mut name = [0u16; 256];
    for index in 0.. {
        let mut length = name.len() as u32;
        let result =
            unsafe { RegEnumKeyExW(key, index, Some(PWSTR(name.as_mut_ptr())), &mut length, None, None, None, None) };
        if result.is_err() {
            break;
        }
        names.push(String::from_utf16_lossy(&name[..length as usize]));
    }
    let _ = unsafe { RegCloseKey(key) };
    names
}

pub(crate) fn display_icon_path(icon: &str) -> &str {
    icon.rsplit_once(',')
        .filter(|(_, index)| index.trim().parse::<i32>().is_ok())
        .map_or(icon, |(path, _)| path)
        .trim()
        .trim_matches('"')
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::System::Registry::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};

    const CURRENT_VERSION: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";

    #[test]
    fn reads_a_string_value_present_on_every_windows_install() {
        let name = read_string(HKEY_LOCAL_MACHINE, CURRENT_VERSION, "ProductName");
        assert!(name.is_some_and(|name| !name.trim().is_empty()));
    }

    #[test]
    fn missing_keys_and_values_read_as_none() {
        let missing_key = r"Software\FocuSD\NoSuchKey";
        assert_eq!(read_string(HKEY_CURRENT_USER, missing_key, "Value"), None);
        assert_eq!(
            read_string(HKEY_LOCAL_MACHINE, CURRENT_VERSION, "NoSuchValue"),
            None
        );
    }

    #[test]
    fn subkeys_and_qword_values_are_read() {
        let names = subkey_names(HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT");
        assert!(names.iter().any(|name| name == "CurrentVersion"));
        assert!(subkey_names(HKEY_CURRENT_USER, r"Software\FocuSD\NoSuchKey").is_empty());
        assert!(read_u64(HKEY_LOCAL_MACHINE, CURRENT_VERSION, "InstallTime").is_some_and(|time| time > 0));
        assert_eq!(read_u64(HKEY_LOCAL_MACHINE, CURRENT_VERSION, "ProductName"), None);
    }

    #[test]
    fn display_icons_give_the_executable_path() {
        assert_eq!(display_icon_path(r#""D:\Apps\Weixin\Weixin.exe",0"#), r"D:\Apps\Weixin\Weixin.exe");
        assert_eq!(display_icon_path(r"D:\Apps\QQ\QQ.exe, -1"), r"D:\Apps\QQ\QQ.exe");
        assert_eq!(display_icon_path(r"D:\Apps,Tools\QQ.exe"), r"D:\Apps,Tools\QQ.exe");
    }
}
