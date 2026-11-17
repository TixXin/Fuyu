use std::{ffi::c_void, mem::size_of};

use windows::{
    Wdk::System::Threading::{NtQueryInformationProcess, ProcessBasicInformation},
    Win32::System::{
        Diagnostics::Debug::ReadProcessMemory,
        Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_VM_READ},
    },
};

use super::process::ProcessHandle;

const PEB_PROCESS_PARAMETERS: usize = 0x20;
const PARAMETERS_COMMAND_LINE_LENGTH: usize = 0x70;
const PARAMETERS_COMMAND_LINE_BUFFER: usize = 0x78;
const PARAMETERS_ENVIRONMENT: usize = 0x80;
const PARAMETERS_ENVIRONMENT_SIZE: usize = 0x3F0;
const MAX_ENVIRONMENT_BYTES: usize = 1024 * 1024;
const MAX_COMMAND_LINE_BYTES: usize = 64 * 1024;

#[repr(C)]
#[derive(Default)]
struct BasicInformation {
    exit_status: i32,
    peb_base_address: usize,
    affinity_mask: usize,
    base_priority: i32,
    unique_process_id: usize,
    inherited_from_unique_process_id: usize,
}

fn open_parameters(process_id: u32) -> Option<(ProcessHandle, usize)> {
    if cfg!(not(target_pointer_width = "64")) {
        return None;
    }
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, false, process_id) }
        .ok()
        .map(ProcessHandle)?;
    let mut info = BasicInformation::default();
    let status = unsafe {
        NtQueryInformationProcess(
            process.0,
            ProcessBasicInformation,
            &mut info as *mut BasicInformation as *mut c_void,
            size_of::<BasicInformation>() as u32,
            std::ptr::null_mut(),
        )
    };
    if status.is_err() || info.peb_base_address == 0 {
        return None;
    }
    let parameters = read_usize(&process, info.peb_base_address + PEB_PROCESS_PARAMETERS)?;
    (parameters != 0).then_some((process, parameters))
}

pub(crate) fn environment_variable(process_id: u32, name: &str) -> Option<String> {
    let (process, parameters) = open_parameters(process_id)?;
    let environment = read_usize(&process, parameters + PARAMETERS_ENVIRONMENT)?;
    let size = read_usize(&process, parameters + PARAMETERS_ENVIRONMENT_SIZE)?;
    if environment == 0 || size == 0 || size > MAX_ENVIRONMENT_BYTES || size % 2 != 0 {
        return None;
    }
    let mut block = vec![0u16; size / 2];
    read_into(&process, environment, block.as_mut_ptr() as *mut c_void, size)?;
    find_variable(&block, name)
}

pub(crate) fn command_line_args(process_id: u32) -> Option<Vec<String>> {
    let (process, parameters) = open_parameters(process_id)?;
    let mut length_bytes = 0u16;
    read_into(
        &process,
        parameters + PARAMETERS_COMMAND_LINE_LENGTH,
        &mut length_bytes as *mut u16 as *mut c_void,
        size_of::<u16>(),
    )?;
    let size = usize::from(length_bytes);
    let buffer = read_usize(&process, parameters + PARAMETERS_COMMAND_LINE_BUFFER)?;
    if buffer == 0 || size == 0 || size > MAX_COMMAND_LINE_BYTES || size % 2 != 0 {
        return None;
    }
    let mut units = vec![0u16; size / 2];
    read_into(&process, buffer, units.as_mut_ptr() as *mut c_void, size)?;
    let args = split_command_line(&String::from_utf16_lossy(&units));
    (!args.is_empty()).then_some(args)
}

pub(crate) fn split_command_line(line: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut started = false;
    let mut backslashes = 0usize;
    for ch in line.chars() {
        match ch {
            '\\' => {
                started = true;
                backslashes += 1;
            }
            '"' => {
                started = true;
                current.extend(std::iter::repeat_n('\\', backslashes / 2));
                if backslashes % 2 == 0 {
                    in_quotes = !in_quotes;
                } else {
                    current.push('"');
                }
                backslashes = 0;
            }
            ch if ch.is_whitespace() && !in_quotes => {
                if backslashes > 0 {
                    current.extend(std::iter::repeat_n('\\', backslashes));
                    backslashes = 0;
                }
                if started {
                    args.push(std::mem::take(&mut current));
                    started = false;
                }
            }
            ch => {
                started = true;
                if backslashes > 0 {
                    current.extend(std::iter::repeat_n('\\', backslashes));
                    backslashes = 0;
                }
                current.push(ch);
            }
        }
    }
    if backslashes > 0 {
        current.extend(std::iter::repeat_n('\\', backslashes));
    }
    if started {
        args.push(current);
    }
    args
}

pub(crate) fn find_variable(block: &[u16], name: &str) -> Option<String> {
    block
        .split(|&unit| unit == 0)
        .take_while(|entry| !entry.is_empty())
        .map(String::from_utf16_lossy)
        .find_map(|entry| {
            let split = entry.get(1..)?.find('=')? + 1;
            entry[..split]
                .eq_ignore_ascii_case(name)
                .then(|| entry[split + 1..].to_string())
        })
}

fn read_usize(process: &ProcessHandle, address: usize) -> Option<usize> {
    let mut value = 0usize;
    read_into(process, address, &mut value as *mut usize as *mut c_void, size_of::<usize>())?;
    Some(value)
}

fn read_into(process: &ProcessHandle, address: usize, buffer: *mut c_void, length: usize) -> Option<()> {
    let mut read = 0usize;
    unsafe { ReadProcessMemory(process.0, address as *const c_void, buffer, length, Some(&mut read)) }.ok()?;
    (read == length).then_some(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_variable_of_the_current_process_the_same_as_std() {
        let expected = std::env::var("PATH").ok();
        assert!(expected.is_some());
        assert_eq!(environment_variable(std::process::id(), "path"), expected);
        assert_eq!(environment_variable(std::process::id(), "FUYU_SURELY_UNSET_VARIABLE"), None);
        assert_eq!(environment_variable(u32::MAX, "PATH"), None);
    }

    #[test]
    fn reads_current_process_command_line_and_splits_quoted_paths() {
        let actual = command_line_args(std::process::id()).expect("current command line");
        let expected: Vec<String> = std::env::args().collect();
        assert_eq!(actual, expected);
        assert_eq!(command_line_args(u32::MAX), None);
        assert_eq!(
            split_command_line(r#""C:\Program Files\Antigravity\language_server.exe" --csrf_token=abc --port 0"#),
            vec![r"C:\Program Files\Antigravity\language_server.exe", "--csrf_token=abc", "--port", "0"]
        );
    }

    #[test]
    fn environment_blocks_are_split_into_entries() {
        let block: Vec<u16> = "=C:=C:\\\0Orca_Terminal_Handle=term_1\0X=a=b\0\0".encode_utf16().collect();
        assert_eq!(find_variable(&block, "ORCA_TERMINAL_HANDLE").as_deref(), Some("term_1"));
        assert_eq!(find_variable(&block, "X").as_deref(), Some("a=b"));
        assert_eq!(find_variable(&block, "C:"), None);
    }
}
