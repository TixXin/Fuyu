use std::{iter::once, mem::ManuallyDrop, os::windows::ffi::OsStrExt, path::Path, ptr};

use windows::{
    core::{w, PCWSTR},
    Win32::{
        Foundation::{GlobalFree, HGLOBAL, HWND},
        System::{
            Com::{IDataObject, DVASPECT_CONTENT, FORMATETC, STGMEDIUM, STGMEDIUM_0, TYMED_HGLOBAL},
            DataExchange::RegisterClipboardFormatW,
            Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE},
            Ole::{
                IDropSource, OleInitialize, OleUninitialize, DROPEFFECT, DROPEFFECT_COPY,
                DROPEFFECT_LINK, DROPEFFECT_MOVE,
            },
        },
        UI::Shell::{
            BHID_DataObject, Common::ITEMIDLIST, ILCreateFromPathW, ILFree, IShellItemArray,
            SHCreateShellItemArrayFromIDLists, SHDoDragDrop,
        },
    },
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DragOutcome {
    Copied,
    Moved,
    Linked,
    None,
}

struct OleGuard;

impl OleGuard {
    fn new() -> Result<Self, String> {
        unsafe { OleInitialize(None) }
            .map_err(|error| format!("Failed to initialize OLE: {error}"))?;
        Ok(Self)
    }
}

impl Drop for OleGuard {
    fn drop(&mut self) {
        unsafe { OleUninitialize() };
    }
}

struct ItemIdList(*mut ITEMIDLIST);

impl ItemIdList {
    fn from_path(path: &Path) -> Result<Self, String> {
        let wide: Vec<u16> = shell_path(path).encode_wide().chain(once(0)).collect();
        let list = unsafe { ILCreateFromPathW(PCWSTR(wide.as_ptr())) };
        if list.is_null() {
            return Err(format!("File not found: {}", path.display()));
        }
        Ok(Self(list))
    }
}

impl Drop for ItemIdList {
    fn drop(&mut self) {
        unsafe { ILFree(Some(self.0)) };
    }
}

fn shell_path(path: &Path) -> std::ffi::OsString {
    let text = path.as_os_str().to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}").into();
    }
    match text.strip_prefix(r"\\?\") {
        Some(rest) => rest.into(),
        None => path.as_os_str().to_owned(),
    }
}

pub(crate) fn drag_files(window: HWND, paths: &[impl AsRef<Path>]) -> Result<DragOutcome, String> {
    if paths.is_empty() {
        return Ok(DragOutcome::None);
    }
    let _ole = OleGuard::new()?;
    let lists = paths
        .iter()
        .map(|path| ItemIdList::from_path(path.as_ref()))
        .collect::<Result<Vec<_>, _>>()?;
    let pointers: Vec<*const ITEMIDLIST> = lists.iter().map(|list| list.0.cast_const()).collect();

    let items: IShellItemArray = unsafe { SHCreateShellItemArrayFromIDLists(&pointers) }
        .map_err(|error| format!("Failed to prepare the dragged files: {error}"))?;
    let data: IDataObject = unsafe { items.BindToHandler(None, &BHID_DataObject) }
        .map_err(|error| format!("Failed to prepare the dragged files: {error}"))?;
    set_preferred_effect(&data, DROPEFFECT_COPY)?;

    let allowed = DROPEFFECT_COPY | DROPEFFECT_MOVE | DROPEFFECT_LINK;
    let effect = unsafe { SHDoDragDrop(Some(window), &data, None::<&IDropSource>, allowed) }
        .map_err(|error| format!("Failed to drag the files: {error}"))?;
    Ok(outcome(effect))
}

fn outcome(effect: DROPEFFECT) -> DragOutcome {
    if effect.0 & DROPEFFECT_MOVE.0 != 0 {
        DragOutcome::Moved
    } else if effect.0 & DROPEFFECT_COPY.0 != 0 {
        DragOutcome::Copied
    } else if effect.0 & DROPEFFECT_LINK.0 != 0 {
        DragOutcome::Linked
    } else {
        DragOutcome::None
    }
}

fn set_preferred_effect(data: &IDataObject, effect: DROPEFFECT) -> Result<(), String> {
    let format = unsafe { RegisterClipboardFormatW(w!("Preferred DropEffect")) };
    if format == 0 {
        return Err("Failed to register the drop effect format".to_string());
    }
    let memory: HGLOBAL = unsafe { GlobalAlloc(GMEM_MOVEABLE, size_of::<u32>()) }
        .map_err(|error| format!("Failed to allocate the drop effect: {error}"))?;
    unsafe {
        let pointer = GlobalLock(memory).cast::<u32>();
        if pointer.is_null() {
            let _ = GlobalFree(Some(memory));
            return Err("Failed to write the drop effect".to_string());
        }
        pointer.write_unaligned(effect.0);
        let _ = GlobalUnlock(memory);
    }

    let format_etc = FORMATETC {
        cfFormat: format as u16,
        ptd: ptr::null_mut(),
        dwAspect: DVASPECT_CONTENT.0,
        lindex: -1,
        tymed: TYMED_HGLOBAL.0 as u32,
    };
    let medium = STGMEDIUM {
        tymed: TYMED_HGLOBAL.0 as u32,
        u: STGMEDIUM_0 { hGlobal: memory },
        pUnkForRelease: ManuallyDrop::new(None),
    };
    if let Err(error) = unsafe { data.SetData(&format_etc, &medium, true) } {
        let _ = unsafe { GlobalFree(Some(memory)) };
        return Err(format!("Failed to set the drop effect: {error}"));
    }
    Ok(())
}
