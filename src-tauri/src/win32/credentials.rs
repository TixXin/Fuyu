use windows::{
    core::{HSTRING, PCWSTR, PWSTR},
    Win32::{
        Foundation::ERROR_NOT_FOUND,
        Security::Credentials::{
            CredDeleteW, CredEnumerateW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS,
            CRED_FLAGS_USERNAME_TARGET, CRED_TYPE_GENERIC,
        },
    },
};

struct CredBuffer(*const core::ffi::c_void);

impl Drop for CredBuffer {
    fn drop(&mut self) {
        unsafe { CredFree(self.0) };
    }
}

fn exists(target: &HSTRING) -> bool {
    let mut found: *mut CREDENTIALW = std::ptr::null_mut();
    let read = unsafe { CredReadW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, None, &mut found) };
    if read.is_ok() {
        drop(CredBuffer(found as *const _));
    }
    read.is_ok()
}

pub(crate) fn copy_generic_credentials(rename: impl Fn(&str) -> Option<String>) -> Result<usize, String> {
    let mut count = 0u32;
    let mut list: *mut *mut CREDENTIALW = std::ptr::null_mut();
    if let Err(error) = unsafe { CredEnumerateW(PCWSTR::null(), None, &mut count, &mut list) } {
        if error.code() == ERROR_NOT_FOUND.to_hresult() {
            return Ok(0);
        }
        return Err(format!("Could not list the saved credentials: {error}"));
    }
    let _buffer = CredBuffer(list as *const _);
    let items = unsafe { std::slice::from_raw_parts(list, count as usize) };
    let mut copied = 0;
    for &item in items {
        let credential = unsafe { *item };
        if credential.Type != CRED_TYPE_GENERIC || credential.TargetName.is_null() {
            continue;
        }
        let Ok(target) = (unsafe { credential.TargetName.to_string() }) else {
            continue;
        };
        let Some(new_target) = rename(&target) else {
            continue;
        };
        let new_target = HSTRING::from(new_target.as_str());
        if exists(&new_target) {
            continue;
        }
        let mut copy = credential;
        copy.TargetName = PWSTR(new_target.as_ptr() as *mut u16);
        copy.Flags = CRED_FLAGS(credential.Flags.0 & CRED_FLAGS_USERNAME_TARGET.0);
        unsafe { CredWriteW(&copy, 0) }.map_err(|error| format!("Could not copy the credential {target}: {error}"))?;
        copied += 1;
    }
    Ok(copied)
}

pub(crate) fn delete_generic_credentials(matches: impl Fn(&str) -> bool) -> Result<usize, String> {
    let mut count = 0u32;
    let mut list: *mut *mut CREDENTIALW = std::ptr::null_mut();
    if let Err(error) = unsafe { CredEnumerateW(PCWSTR::null(), None, &mut count, &mut list) } {
        if error.code() == ERROR_NOT_FOUND.to_hresult() {
            return Ok(0);
        }
        return Err(format!("Could not list the saved credentials: {error}"));
    }
    let targets = {
        let _buffer = CredBuffer(list as *const _);
        let items = unsafe { std::slice::from_raw_parts(list, count as usize) };
        let mut matched = Vec::new();
        for &item in items {
            if item.is_null() {
                continue;
            }
            let credential = unsafe { *item };
            if credential.Type != CRED_TYPE_GENERIC || credential.TargetName.is_null() {
                continue;
            }
            let Ok(target) = (unsafe { credential.TargetName.to_string() }) else {
                continue;
            };
            if matches(&target) {
                matched.push(target);
            }
        }
        matched
    };
    let mut deleted = 0;
    let mut errors = Vec::new();
    for target in targets {
        let wide = HSTRING::from(target.as_str());
        match unsafe { CredDeleteW(PCWSTR(wide.as_ptr()), CRED_TYPE_GENERIC, None) } {
            Ok(()) => deleted += 1,
            Err(error) if error.code() == ERROR_NOT_FOUND.to_hresult() => {}
            Err(error) => errors.push(format!("Could not delete the credential {target}: {error}")),
        }
    }
    if errors.is_empty() {
        Ok(deleted)
    } else {
        Err(errors.join("; "))
    }
}
