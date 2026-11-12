use std::{ffi::c_void, path::PathBuf};

use windows::Win32::{
    Foundation::{CloseHandle, HANDLE},
    System::{
        Diagnostics::{
            Debug::{ReadProcessMemory, WriteProcessMemory},
            ToolHelp::{
                CreateToolhelp32Snapshot, Module32FirstW, Module32NextW, MODULEENTRY32W,
                TH32CS_SNAPMODULE,
            },
        },
        Threading::{
            OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_OPERATION, PROCESS_VM_READ,
            PROCESS_VM_WRITE,
        },
    },
};

pub(crate) struct ProcessMemory(HANDLE);

impl ProcessMemory {
    pub(crate) fn open(process_id: u32) -> Option<Self> {
        let access =
            PROCESS_VM_READ | PROCESS_VM_WRITE | PROCESS_VM_OPERATION | PROCESS_QUERY_INFORMATION;
        unsafe { OpenProcess(access, false, process_id) }
            .ok()
            .map(Self)
    }

    pub(crate) fn read_byte(&self, address: usize) -> Option<u8> {
        let mut byte = 0u8;
        let mut done = 0usize;
        unsafe {
            ReadProcessMemory(
                self.0,
                address as *const c_void,
                (&raw mut byte).cast(),
                1,
                Some(&mut done),
            )
        }
        .ok()?;
        (done == 1).then_some(byte)
    }

    pub(crate) fn write_byte(&self, address: usize, value: u8) -> bool {
        let mut done = 0usize;
        let written = unsafe {
            WriteProcessMemory(
                self.0,
                address as *const c_void,
                (&raw const value).cast(),
                1,
                Some(&mut done),
            )
        };
        written.is_ok() && done == 1
    }
}

impl Drop for ProcessMemory {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}

pub(crate) fn module(process_id: u32, name: &str) -> Option<(usize, PathBuf)> {
    let guard = Snapshot(unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPMODULE, process_id) }.ok()?);
    let snapshot = guard.0;
    let mut entry = MODULEENTRY32W {
        dwSize: size_of::<MODULEENTRY32W>() as u32,
        ..Default::default()
    };
    let text = |chars: &[u16]| {
        let end = chars.iter().position(|c| *c == 0).unwrap_or(chars.len());
        String::from_utf16_lossy(&chars[..end])
    };
    let mut found = None;
    let mut more = unsafe { Module32FirstW(snapshot, &mut entry) }.is_ok();
    while more {
        if text(&entry.szModule).eq_ignore_ascii_case(name) {
            found = Some((
                entry.modBaseAddr as usize,
                PathBuf::from(text(&entry.szExePath)),
            ));
            break;
        }
        more = unsafe { Module32NextW(snapshot, &mut entry) }.is_ok();
    }
    found
}

struct Snapshot(HANDLE);

impl Drop for Snapshot {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}
