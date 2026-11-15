use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS, PROCESS_MEMORY_COUNTERS_EX2};

use super::process::open_for_limited_query;

pub(crate) fn private_bytes(process_id: u32) -> Option<u64> {
    let process = open_for_limited_query(process_id)?;
    let mut counters = PROCESS_MEMORY_COUNTERS_EX2 { cb: size_of::<PROCESS_MEMORY_COUNTERS_EX2>() as u32, ..Default::default() };
    unsafe {
        GetProcessMemoryInfo(process.0, (&mut counters as *mut PROCESS_MEMORY_COUNTERS_EX2).cast::<PROCESS_MEMORY_COUNTERS>(), counters.cb)
    }
    .ok()?;
    Some(counters.PrivateWorkingSetSize as u64).filter(|bytes| *bytes > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_current_process_has_private_memory_and_missing_ones_do_not() {
        let held = std::hint::black_box(vec![1u8; 8 << 20]);
        assert!(private_bytes(std::process::id()).is_some_and(|bytes| bytes >= held.len() as u64));
        assert_eq!(private_bytes(u32::MAX), None);
    }
}
