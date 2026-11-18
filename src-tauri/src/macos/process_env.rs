use std::{ffi::c_void, mem::size_of, ptr};

use libc::{c_int, size_t, CTL_KERN, KERN_ARGMAX, KERN_PROCARGS2};

const DEFAULT_ARGMAX: usize = 262_144;
const MAX_ARGMAX: usize = 512 * 1024;
const MAX_ARGC: usize = 4096;

pub(crate) fn environment_variable(_process_id: u32, _name: &str) -> Option<String> {
    None
}

fn arg_max() -> usize {
    let mut mib = [CTL_KERN, KERN_ARGMAX];
    let mut value: c_int = 0;
    let mut size: size_t = size_of::<c_int>();
    let ok = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            2,
            (&mut value as *mut c_int).cast::<c_void>(),
            &mut size,
            ptr::null_mut(),
            0,
        )
    };
    if ok == 0 && value > 0 {
        usize::try_from(value).unwrap_or(DEFAULT_ARGMAX).clamp(4096, MAX_ARGMAX)
    } else {
        DEFAULT_ARGMAX
    }
}

pub(crate) fn command_line_args(process_id: u32) -> Option<Vec<String>> {
    let pid = c_int::try_from(process_id).ok().filter(|pid| *pid > 0)?;
    let mut mib = [CTL_KERN, KERN_PROCARGS2, pid];
    let mut buffer = vec![0u8; arg_max()];
    let mut size: size_t = buffer.len();
    let ok = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            3,
            buffer.as_mut_ptr().cast::<c_void>(),
            &mut size,
            ptr::null_mut(),
            0,
        )
    };
    if ok != 0 || size < size_of::<c_int>() || size > buffer.len() {
        return None;
    }
    parse_procargs2(&buffer[..size])
}

fn parse_procargs2(bytes: &[u8]) -> Option<Vec<String>> {
    let header: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
    let argc = usize::try_from(c_int::from_ne_bytes(header)).ok()?.min(MAX_ARGC);
    if argc == 0 {
        return None;
    }
    let exec_end = 4 + bytes.get(4..)?.iter().position(|&byte| byte == 0)?;
    let mut at = exec_end + 1;
    while at < bytes.len() && bytes[at] == 0 {
        at += 1;
    }
    let mut args = Vec::with_capacity(argc);
    for _ in 0..argc {
        if at >= bytes.len() {
            break;
        }
        let end = bytes[at..].iter().position(|&byte| byte == 0).map_or(bytes.len(), |offset| at + offset);
        args.push(String::from_utf8_lossy(&bytes[at..end]).into_owned());
        at = end + 1;
    }
    (!args.is_empty()).then_some(args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_current_process_arguments() {
        let actual = command_line_args(std::process::id()).expect("current process args");
        let expected: Vec<String> = std::env::args().collect();
        assert_eq!(actual, expected);
        assert_eq!(command_line_args(u32::MAX), None);
    }

    #[test]
    fn parses_procargs2_buffer_with_spaces_in_paths() {
        let mut raw = Vec::new();
        raw.extend_from_slice(&(3 as c_int).to_ne_bytes());
        raw.extend_from_slice(b"/Applications/Antigravity.app/Contents/Resources/bin/language_server\0\0\0");
        raw.extend_from_slice(b"/Applications/Antigravity.app/Contents/Resources/bin/language_server\0--csrf_token\0tok_1\0ENV=1\0");
        assert_eq!(
            parse_procargs2(&raw),
            Some(vec![
                "/Applications/Antigravity.app/Contents/Resources/bin/language_server".into(),
                "--csrf_token".into(),
                "tok_1".into(),
            ])
        );
    }
}
