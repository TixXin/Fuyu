use std::marker::PhantomData;

use windows::Win32::System::{
    Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED},
    WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED},
};

pub(crate) struct ComApartment {
    _thread_bound: PhantomData<*const ()>,
}

impl ComApartment {
    pub(crate) fn multithreaded() -> windows::core::Result<Self> {
        unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.ok()?;
        Ok(Self {
            _thread_bound: PhantomData,
        })
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}

pub(crate) struct WinRtApartment {
    _thread_bound: PhantomData<*const ()>,
}

impl WinRtApartment {
    pub(crate) fn multithreaded() -> windows::core::Result<Self> {
        unsafe { RoInitialize(RO_INIT_MULTITHREADED) }?;
        Ok(Self {
            _thread_bound: PhantomData,
        })
    }
}

impl Drop for WinRtApartment {
    fn drop(&mut self) {
        unsafe { RoUninitialize() };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apartments_can_be_entered_repeatedly_and_nested() {
        std::thread::spawn(|| {
            for _ in 0..2 {
                let _com = ComApartment::multithreaded().unwrap();
                let _winrt = WinRtApartment::multithreaded().unwrap();
            }
        })
        .join()
        .unwrap();
    }
}
