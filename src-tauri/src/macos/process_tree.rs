use std::collections::HashMap;

use super::{apps, proc_info};

const LAUNCHD: u32 = 1;

pub(crate) fn parent_process_ids() -> HashMap<u32, u32> {
    proc_info::all_pids()
        .into_iter()
        .filter_map(|pid| {
            let parent = proc_info::bsd_info(pid)?.pbi_ppid;
            Some((pid, if parent == LAUNCHD { responsible_parent(pid).unwrap_or(parent) } else { parent }))
        })
        .collect()
}

fn responsible_parent(pid: u32) -> Option<u32> {
    let responsible = u32::try_from(apps::responsible_pid(i32::try_from(pid).ok()?)).ok()?;
    (responsible != pid && responsible != LAUNCHD).then_some(responsible)
}
