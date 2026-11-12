use std::{collections::HashMap, mem::size_of};

use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};

use super::process::ProcessHandle;

pub(crate) fn parent_process_ids() -> HashMap<u32, u32> {
    let mut parents = HashMap::new();
    let Ok(snapshot) = (unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }).map(ProcessHandle) else {
        return parents;
    };
    let mut entry = PROCESSENTRY32W { dwSize: size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
    let mut more = unsafe { Process32FirstW(snapshot.0, &mut entry) }.is_ok();
    while more {
        parents.insert(entry.th32ProcessID, entry.th32ParentProcessID);
        more = unsafe { Process32NextW(snapshot.0, &mut entry) }.is_ok();
    }
    parents
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_current_process_is_listed_with_its_parent() {
        let parents = parent_process_ids();
        assert!(parents.get(&std::process::id()).is_some_and(|parent| *parent != 0));
    }
}
