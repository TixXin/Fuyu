use std::{ffi::CStr, mem, ptr, sync::OnceLock};

const CPU_STATE_USER: usize = 0;
const CPU_STATE_SYSTEM: usize = 1;
const CPU_STATE_IDLE: usize = 2;
const CPU_STATE_NICE: usize = 3;

extern "C" {
    fn mach_host_self() -> libc::mach_port_t;
}

fn host() -> libc::mach_port_t {
    static HOST: OnceLock<libc::mach_port_t> = OnceLock::new();
    *HOST.get_or_init(|| unsafe { mach_host_self() })
}

pub(crate) fn cpu_times() -> Option<(u64, u64)> {
    let mut info = libc::host_cpu_load_info { cpu_ticks: [0; 4] };
    let mut count = libc::HOST_CPU_LOAD_INFO_COUNT;
    let status = unsafe { libc::host_statistics(host(), libc::HOST_CPU_LOAD_INFO, (&mut info as *mut libc::host_cpu_load_info).cast(), &mut count) };
    if status != libc::KERN_SUCCESS {
        return None;
    }
    let ticks = info.cpu_ticks.map(u64::from);
    let busy = ticks[CPU_STATE_USER] + ticks[CPU_STATE_SYSTEM] + ticks[CPU_STATE_NICE];
    Some((busy, busy + ticks[CPU_STATE_IDLE]))
}

fn total_memory() -> Option<u64> {
    let mut total: u64 = 0;
    let mut size = mem::size_of::<u64>();
    let status = unsafe { libc::sysctlbyname(c"hw.memsize".as_ptr(), (&mut total as *mut u64).cast(), &mut size, ptr::null_mut(), 0) };
    (status == 0 && total > 0).then_some(total)
}

pub(crate) fn memory() -> Option<(u64, u64)> {
    let total = total_memory()?;
    let mut stats: libc::vm_statistics64 = unsafe { mem::zeroed() };
    let mut count = libc::HOST_VM_INFO64_COUNT;
    let status = unsafe { libc::host_statistics64(host(), libc::HOST_VM_INFO64, (&mut stats as *mut libc::vm_statistics64).cast(), &mut count) };
    if status != libc::KERN_SUCCESS {
        return None;
    }
    let page = unsafe { libc::vm_page_size } as u64;
    let pages = u64::from(stats.active_count) + u64::from(stats.wire_count) + u64::from(stats.compressor_page_count);
    Some(((pages * page).min(total), total))
}

pub(crate) fn network_counters() -> Vec<(String, u64, u64)> {
    let mut first: *mut libc::ifaddrs = ptr::null_mut();
    if unsafe { libc::getifaddrs(&mut first) } != 0 {
        return Vec::new();
    }
    let mut found = Vec::new();
    let mut cursor = first;
    while !cursor.is_null() {
        let entry = unsafe { &*cursor };
        cursor = entry.ifa_next;
        let flags = entry.ifa_flags as libc::c_int;
        if entry.ifa_addr.is_null() || entry.ifa_data.is_null() || flags & libc::IFF_UP == 0 || flags & libc::IFF_LOOPBACK != 0 {
            continue;
        }
        if libc::c_int::from(unsafe { (*entry.ifa_addr).sa_family }) != libc::AF_LINK {
            continue;
        }
        let data = unsafe { &*(entry.ifa_data as *const libc::if_data) };
        let name = unsafe { CStr::from_ptr(entry.ifa_name) }.to_string_lossy().into_owned();
        found.push((name, u64::from(data.ifi_ibytes), u64::from(data.ifi_obytes)));
    }
    unsafe { libc::freeifaddrs(first) };
    found
}

#[cfg(test)]
mod tests {
    use super::{cpu_times, memory, network_counters};

    #[test]
    fn this_mac_reports_cpu_memory_and_network_counters() {
        let (busy, total) = cpu_times().unwrap_or((0, 0));
        assert!(busy <= total);
        let (used, total) = memory().unwrap_or((0, 1));
        assert!(used <= total);
        assert!(network_counters().iter().all(|(name, _, _)| !name.is_empty()));
    }
}
