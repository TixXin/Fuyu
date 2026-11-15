use std::ffi::c_int;

use libc::{rusage_info_t, rusage_info_v2, RUSAGE_INFO_V2};

pub(crate) fn private_bytes(process_id: u32) -> Option<u64> {
    let pid = c_int::try_from(process_id).ok().filter(|pid| *pid > 0)?;
    let mut info: rusage_info_v2 = unsafe { std::mem::zeroed() };
    let result = unsafe { libc::proc_pid_rusage(pid, RUSAGE_INFO_V2, (&mut info as *mut rusage_info_v2).cast::<rusage_info_t>()) };
    (result == 0).then_some(info.ri_phys_footprint).filter(|bytes| *bytes > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_current_process_has_a_footprint_and_missing_ones_do_not() {
        let held = std::hint::black_box(vec![1u8; 8 << 20]);
        assert!(private_bytes(std::process::id()).is_some_and(|bytes| bytes >= held.len() as u64));
        assert_eq!(private_bytes(u32::MAX), None);
    }
}
