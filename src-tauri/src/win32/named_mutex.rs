use windows::{
    core::HSTRING,
    Win32::{
        Foundation::CloseHandle,
        System::Threading::{OpenMutexW, SYNCHRONIZATION_SYNCHRONIZE},
    },
};

pub(crate) fn exists(name: &str) -> bool {
    match unsafe { OpenMutexW(SYNCHRONIZATION_SYNCHRONIZE, false, &HSTRING::from(name)) } {
        Ok(handle) => {
            let _ = unsafe { CloseHandle(handle) };
            true
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::exists;
    use windows::{
        core::HSTRING,
        Win32::{Foundation::CloseHandle, System::Threading::CreateMutexW},
    };

    #[test]
    fn a_mutex_is_seen_only_while_some_process_holds_it() {
        let name = format!("fuyu-test-mutex-{}", std::process::id());
        assert!(!exists(&name));
        let held = unsafe { CreateMutexW(None, false, &HSTRING::from(name.as_str())) }.expect("create the mutex");
        assert!(exists(&name));
        let _ = unsafe { CloseHandle(held) };
        assert!(!exists(&name));
    }
}
