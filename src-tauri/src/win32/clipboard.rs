use windows::{
    core::{w, Result, PCWSTR},
    Win32::{
        Foundation::{HGLOBAL, HWND},
        System::{
            DataExchange::{
                AddClipboardFormatListener, CloseClipboard, EmptyClipboard, GetClipboardData,
                GetClipboardOwner,
                IsClipboardFormatAvailable, OpenClipboard, RegisterClipboardFormatW,
                RemoveClipboardFormatListener,
            },
            Memory::{GlobalLock, GlobalSize, GlobalUnlock},
        },
    },
};

pub(crate) fn add_format_listener(window: HWND) -> Result<()> {
    unsafe { AddClipboardFormatListener(window) }
}

pub(crate) fn remove_format_listener(window: HWND) -> Result<()> {
    unsafe { RemoveClipboardFormatListener(window) }
}

pub(crate) fn empty() -> Result<()> {
    unsafe {
        OpenClipboard(None)?;
        let emptied = EmptyClipboard();
        CloseClipboard()?;
        emptied
    }
}

pub(crate) fn owner_window() -> Option<HWND> {
    unsafe { GetClipboardOwner() }.ok().filter(|window| !window.is_invalid())
}

fn format_id(name: PCWSTR) -> u32 {
    unsafe { RegisterClipboardFormatW(name) }
}

fn has_format(format: u32) -> bool {
    format != 0 && unsafe { IsClipboardFormatAvailable(format) }.is_ok()
}

pub(crate) fn is_marked_private() -> bool {
    if has_format(format_id(w!("ExcludeClipboardContentFromMonitorProcessing")))
        || has_format(format_id(w!("Clipboard Viewer Ignore")))
    {
        return true;
    }
    let history = format_id(w!("CanIncludeInClipboardHistory"));
    has_format(history) && read_dword(history) == Some(0)
}

fn read_dword(format: u32) -> Option<u32> {
    unsafe {
        OpenClipboard(None).ok()?;
        let value = GetClipboardData(format).ok().and_then(|handle| {
            let global = HGLOBAL(handle.0);
            if GlobalSize(global) < std::mem::size_of::<u32>() {
                return None;
            }
            let pointer = GlobalLock(global) as *const u32;
            if pointer.is_null() {
                return None;
            }
            let value = pointer.read_unaligned();
            let _ = GlobalUnlock(global);
            Some(value)
        });
        let _ = CloseClipboard();
        value
    }
}
