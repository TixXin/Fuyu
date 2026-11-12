use std::mem::size_of;
use windows::{
    core::PWSTR,
    Win32::{
        Foundation::{CloseHandle, HANDLE, HWND},
        System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
        System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
            PROCESS_QUERY_LIMITED_INFORMATION,
        },
        UI::WindowsAndMessaging::GetWindowThreadProcessId,
    },
};

const MAX_IMAGE_PATH_UNITS: usize = 32768;

pub(super) struct ProcessHandle(pub(super) HANDLE);

pub(super) fn open_for_limited_query(process_id: u32) -> Option<ProcessHandle> {
    unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) }
        .ok()
        .map(ProcessHandle)
}

impl Drop for ProcessHandle {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}

pub(crate) fn window_process_id(window: HWND) -> u32 {
    let mut process_id = 0;
    unsafe { GetWindowThreadProcessId(window, Some(&mut process_id)) };
    process_id
}

pub(crate) fn image_path(process_id: u32) -> Option<String> {
    let process = open_for_limited_query(process_id)?;
    let mut path = [0u16; MAX_IMAGE_PATH_UNITS];
    let mut length = path.len() as u32;
    unsafe {
        QueryFullProcessImageNameW(
            process.0,
            PROCESS_NAME_WIN32,
            PWSTR(path.as_mut_ptr()),
            &mut length,
        )
    }
    .ok()?;
    Some(String::from_utf16_lossy(&path[..length as usize]))
}

pub(crate) fn running_executable(file_names: &[&str]) -> Option<String> {
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }
        .ok()
        .map(ProcessHandle)?;
    let mut entry = PROCESSENTRY32W {
        dwSize: size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut more = unsafe { Process32FirstW(snapshot.0, &mut entry) }.is_ok();
    while more {
        let length = entry
            .szExeFile
            .iter()
            .position(|unit| *unit == 0)
            .unwrap_or(entry.szExeFile.len());
        let name = String::from_utf16_lossy(&entry.szExeFile[..length]);
        if file_names.iter().any(|wanted| wanted.eq_ignore_ascii_case(&name)) {
            if let Some(path) = image_path(entry.th32ProcessID) {
                return Some(path);
            }
        }
        more = unsafe { Process32NextW(snapshot.0, &mut entry) }.is_ok();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_a_running_process_by_its_file_name() {
        let current = std::env::current_exe().expect("current exe");
        let name = current.file_name().expect("file name").to_string_lossy().to_uppercase();
        let found = running_executable(&["NoSuchProgram.exe", &name]).map(std::path::PathBuf::from);
        assert_eq!(found.and_then(|path| path.file_name().map(|name| name.to_os_string())), current.file_name().map(|name| name.to_os_string()));
        assert_eq!(running_executable(&["NoSuchProgram.exe"]), None);
    }

    #[test]
    fn reads_the_image_path_of_the_current_process() {
        let path = image_path(std::process::id()).map(std::path::PathBuf::from);
        let current = std::env::current_exe().ok();
        assert!(path.is_some());
        assert_eq!(
            path.and_then(|path| path.file_name().map(|name| name.to_os_string())),
            current.and_then(|path| path.file_name().map(|name| name.to_os_string()))
        );
    }

    #[test]
    fn invalid_windows_and_missing_processes_have_no_owner() {
        assert_eq!(window_process_id(HWND::default()), 0);
        assert_eq!(image_path(u32::MAX), None);
    }
}
