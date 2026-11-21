use std::{mem, ptr, slice};

use windows::Win32::{
    Foundation::{FILETIME, NO_ERROR},
    NetworkManagement::{
        IpHelper::{FreeMibTable, GetIfTable2, MIB_IF_TABLE2},
        Ndis::IfOperStatusUp,
    },
    System::{
        SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX},
        Threading::GetSystemTimes,
    },
};

const SOFTWARE_LOOPBACK: u32 = 24;
const HARDWARE_INTERFACE: u8 = 1;

fn ticks(time: FILETIME) -> u64 {
    (u64::from(time.dwHighDateTime) << 32) | u64::from(time.dwLowDateTime)
}

pub(crate) fn cpu_times() -> Option<(u64, u64)> {
    let mut idle = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)) }.ok()?;
    let total = ticks(kernel) + ticks(user);
    Some((total.saturating_sub(ticks(idle)), total))
}

pub(crate) fn memory() -> Option<(u64, u64)> {
    let mut status = MEMORYSTATUSEX { dwLength: mem::size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
    unsafe { GlobalMemoryStatusEx(&mut status) }.ok()?;
    let total = status.ullTotalPhys;
    (total > 0).then(|| (total.saturating_sub(status.ullAvailPhys), total))
}

pub(crate) fn network_counters() -> Vec<(String, u64, u64)> {
    let mut table: *mut MIB_IF_TABLE2 = ptr::null_mut();
    if unsafe { GetIfTable2(&mut table) } != NO_ERROR || table.is_null() {
        return Vec::new();
    }
    let rows = unsafe { slice::from_raw_parts((*table).Table.as_ptr(), (*table).NumEntries as usize) };
    let found = rows
        .iter()
        .filter(|row| row.Type != SOFTWARE_LOOPBACK && row.OperStatus == IfOperStatusUp && row.InterfaceAndOperStatusFlags._bitfield & HARDWARE_INTERFACE != 0)
        .map(|row| (row.InterfaceIndex.to_string(), row.InOctets, row.OutOctets))
        .collect();
    unsafe { FreeMibTable(table.cast()) };
    found
}
