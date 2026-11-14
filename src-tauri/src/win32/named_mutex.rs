use windows::{
    core::HSTRING,
    Win32::{
        Foundation::{CloseHandle, HANDLE},
        System::Threading::{CreateMutexW, OpenMutexW, SYNCHRONIZATION_SYNCHRONIZE},
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

pub(crate) struct Held(HANDLE);

unsafe impl Send for Held {}
unsafe impl Sync for Held {}

impl Drop for Held {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}

pub(crate) fn hold(name: &str) -> Option<Held> {
    unsafe { CreateMutexW(None, false, &HSTRING::from(name)) }.ok().map(Held)
}

#[cfg(test)]
mod tests {
    use super::{exists, hold};

    #[test]
    fn a_mutex_is_seen_only_while_some_process_holds_it() {
        let name = format!("fuyu-test-mutex-{}", std::process::id());
        assert!(!exists(&name));
        let held = hold(&name).expect("create the mutex");
        assert!(exists(&name));
        let second = hold(&name).expect("open it a second time");
        drop(held);
        assert!(exists(&name));
        drop(second);
        assert!(!exists(&name));
    }
}
