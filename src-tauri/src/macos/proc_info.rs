use std::{
    ffi::{c_void, CStr},
    mem::size_of,
    sync::OnceLock,
};

use libc::{c_int, proc_bsdinfo, proc_taskinfo, PROC_PIDPATHINFO_MAXSIZE, PROC_PIDTASKINFO, PROC_PIDTBSDINFO};

const MAX_PIDS: usize = 16_384;

pub(crate) fn bsd_info(pid: u32) -> Option<proc_bsdinfo> {
    let pid = c_int::try_from(pid).ok().filter(|pid| *pid > 0)?;
    let mut info: proc_bsdinfo = unsafe { std::mem::zeroed() };
    let size = c_int::try_from(size_of::<proc_bsdinfo>()).ok()?;
    let written = unsafe { libc::proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, (&mut info as *mut proc_bsdinfo).cast::<c_void>(), size) };
    (written == size).then_some(info)
}

pub(crate) fn all_pids() -> Vec<u32> {
    let mut pids = vec![0 as c_int; MAX_PIDS];
    let bytes = c_int::try_from(pids.len() * size_of::<c_int>()).unwrap_or(c_int::MAX);
    let count = unsafe { libc::proc_listallpids(pids.as_mut_ptr().cast::<c_void>(), bytes) };
    let count = usize::try_from(count).unwrap_or(0).min(pids.len());
    pids.truncate(count);
    pids.into_iter().filter_map(|pid| u32::try_from(pid).ok()).filter(|pid| *pid > 0).collect()
}

pub(crate) fn executable_path(pid: u32) -> Option<String> {
    let pid = c_int::try_from(pid).ok().filter(|pid| *pid > 0)?;
    let mut buffer = vec![0u8; PROC_PIDPATHINFO_MAXSIZE as usize];
    let length = unsafe { libc::proc_pidpath(pid, buffer.as_mut_ptr().cast::<c_void>(), buffer.len() as u32) };
    let length = usize::try_from(length).ok().filter(|length| *length > 0)?;
    buffer.truncate(length);
    String::from_utf8(buffer).ok()
}

pub(crate) fn tty_path(pid: u32) -> Option<String> {
    let device = bsd_info(pid)?.e_tdev;
    if device == 0 || device == u32::MAX {
        return None;
    }
    let name = unsafe { libc::devname(device as libc::dev_t, libc::S_IFCHR) };
    if name.is_null() {
        return None;
    }
    let name = unsafe { CStr::from_ptr(name) }.to_str().ok()?;
    Some(format!("/dev/{name}"))
}

pub(crate) fn process_group(pid: u32) -> Option<u32> {
    Some(bsd_info(pid)?.pbi_pgid)
}

pub(crate) fn name(pid: u32) -> Option<String> {
    let info = bsd_info(pid)?;
    let bytes: Vec<u8> = info.pbi_name.iter().take_while(|c| **c != 0).map(|c| *c as u8).collect();
    let name = String::from_utf8_lossy(&bytes).into_owned();
    (!name.is_empty()).then_some(name)
}

fn task_info(pid: u32) -> Option<proc_taskinfo> {
    let pid = c_int::try_from(pid).ok().filter(|pid| *pid > 0)?;
    let mut info: proc_taskinfo = unsafe { std::mem::zeroed() };
    let size = c_int::try_from(size_of::<proc_taskinfo>()).ok()?;
    let written = unsafe { libc::proc_pidinfo(pid, PROC_PIDTASKINFO, 0, (&mut info as *mut proc_taskinfo).cast::<c_void>(), size) };
    (written == size).then_some(info)
}

pub(crate) fn resident_bytes(pid: u32) -> Option<u64> {
    Some(task_info(pid)?.pti_resident_size)
}

#[allow(deprecated)]
fn timebase() -> (u64, u64) {
    static TIMEBASE: OnceLock<(u64, u64)> = OnceLock::new();
    *TIMEBASE.get_or_init(|| {
        let mut info = libc::mach_timebase_info { numer: 0, denom: 0 };
        let status = unsafe { libc::mach_timebase_info(&mut info) };
        if status == 0 && info.numer > 0 && info.denom > 0 {
            (u64::from(info.numer), u64::from(info.denom))
        } else {
            (1, 1)
        }
    })
}

pub(crate) fn mach_to_100ns(ticks: u64, (numer, denom): (u64, u64)) -> u64 {
    let nanos = u128::from(ticks) * u128::from(numer) / u128::from(denom.max(1));
    u64::try_from(nanos / 100).unwrap_or(u64::MAX)
}

pub(crate) fn cpu_time_100ns(pid: u32) -> Option<u64> {
    let info = task_info(pid)?;
    Some(mach_to_100ns(info.pti_total_user.saturating_add(info.pti_total_system), timebase()))
}
