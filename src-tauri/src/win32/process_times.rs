use windows::Win32::{Foundation::FILETIME, System::Threading::GetProcessTimes};

use super::process::open_for_limited_query;

pub(crate) fn start_time(process_id: u32) -> Option<u64> {
    let process = open_for_limited_query(process_id)?;
    let mut started = FILETIME::default();
    let mut exited = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    unsafe { GetProcessTimes(process.0, &mut started, &mut exited, &mut kernel, &mut user) }
        .ok()?;
    Some(((started.dwHighDateTime as u64) << 32) | started.dwLowDateTime as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_current_process_has_a_start_time_and_missing_ones_do_not() {
        assert!(start_time(std::process::id()).is_some_and(|ticks| ticks > 0));
        assert_eq!(start_time(u32::MAX), None);
    }
}
