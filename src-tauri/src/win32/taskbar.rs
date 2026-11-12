use windows::Win32::{
    Foundation::HWND,
    System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER},
    UI::Shell::{ITaskbarList, TaskbarList},
};

use super::com::ComApartment;

pub(crate) fn set_button(window: HWND, shown: bool) -> bool {
    if window.is_invalid() {
        return false;
    }
    let _com = ComApartment::multithreaded().ok();
    let done = unsafe {
        CoCreateInstance::<_, ITaskbarList>(&TaskbarList, None, CLSCTX_INPROC_SERVER).and_then(
            |list| {
                list.HrInit()?;
                if shown {
                    list.AddTab(window)
                } else {
                    list.DeleteTab(window)
                }
            },
        )
    };
    done.is_ok()
}
