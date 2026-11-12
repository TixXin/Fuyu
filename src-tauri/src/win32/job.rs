use std::{mem::size_of, os::windows::io::AsRawHandle, process::Child};
use windows::Win32::{
    Foundation::{CloseHandle, HANDLE},
    System::{
        JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, QueryInformationJobObject, SetInformationJobObject,
            JobObjectBasicAccountingInformation, JobObjectBasicProcessIdList, JobObjectExtendedLimitInformation,
            JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, JOBOBJECT_BASIC_PROCESS_ID_LIST,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        },
        ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS},
        Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Thread32First, Thread32Next, TH32CS_SNAPTHREAD, THREADENTRY32},
        Threading::{OpenThread, ResumeThread, CREATE_SUSPENDED, THREAD_SUSPEND_RESUME},
    },
};

use super::process::{image_path, open_for_limited_query, ProcessHandle};

pub(crate) const START_SUSPENDED: u32 = CREATE_SUSPENDED.0;

pub(crate) fn resume(process_id: u32) -> Result<(), String> {
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0) }
        .map(ProcessHandle)
        .map_err(|error| format!("Could not list the plugin's threads: {error}"))?;
    let mut entry = THREADENTRY32 { dwSize: size_of::<THREADENTRY32>() as u32, ..Default::default() };
    let mut resumed = 0;
    let mut more = unsafe { Thread32First(snapshot.0, &mut entry) }.is_ok();
    while more {
        if entry.th32OwnerProcessID == process_id {
            if let Ok(thread) = unsafe { OpenThread(THREAD_SUSPEND_RESUME, false, entry.th32ThreadID) }.map(ProcessHandle) {
                if unsafe { ResumeThread(thread.0) } != u32::MAX {
                    resumed += 1;
                }
            }
        }
        more = unsafe { Thread32Next(snapshot.0, &mut entry) }.is_ok();
    }
    if resumed == 0 {
        return Err("Could not let the plugin process start.".into());
    }
    Ok(())
}

const MAX_LISTED_PROCESSES: usize = 64;

pub(crate) struct Job(HANDLE);

unsafe impl Send for Job {}
unsafe impl Sync for Job {}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct JobUsage {
    pub memory_bytes: u64,
    pub cpu_ticks: u64,
    pub processes: Vec<JobProcess>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct JobProcess {
    pub name: String,
    pub private_bytes: u64,
    pub working_set_bytes: u64,
}

impl Job {
    pub(crate) fn new() -> Result<Self, String> {
        let handle = unsafe { CreateJobObjectW(None, None) }.map_err(|error| format!("Could not create a job object: {error}"))?;
        let job = Self(handle);
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        unsafe {
            SetInformationJobObject(
                job.0,
                JobObjectExtendedLimitInformation,
                std::ptr::from_ref(&limits).cast(),
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        }
        .map_err(|error| format!("Could not set up the job object: {error}"))?;
        Ok(job)
    }

    pub(crate) fn assign(&self, child: &Child) -> Result<(), String> {
        let process = HANDLE(child.as_raw_handle());
        unsafe { AssignProcessToJobObject(self.0, process) }.map_err(|error| format!("Could not put the plugin in a job object: {error}"))
    }

    pub(crate) fn usage(&self) -> Option<JobUsage> {
        let mut accounting = JOBOBJECT_BASIC_ACCOUNTING_INFORMATION::default();
        unsafe {
            QueryInformationJobObject(
                Some(self.0),
                JobObjectBasicAccountingInformation,
                std::ptr::from_mut(&mut accounting).cast(),
                size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                None,
            )
        }
        .ok()?;
        let cpu_ticks = u64::try_from(accounting.TotalUserTime).unwrap_or(0) + u64::try_from(accounting.TotalKernelTime).unwrap_or(0);
        let processes: Vec<JobProcess> = self.process_ids().into_iter().filter_map(process_memory).collect();
        let memory_bytes = processes.iter().map(|process| process.private_bytes).sum();
        Some(JobUsage { memory_bytes, cpu_ticks, processes })
    }

    fn process_ids(&self) -> Vec<u32> {
        #[repr(C)]
        struct IdList {
            header: JOBOBJECT_BASIC_PROCESS_ID_LIST,
            more: [usize; MAX_LISTED_PROCESSES - 1],
        }
        let mut list = IdList { header: JOBOBJECT_BASIC_PROCESS_ID_LIST::default(), more: [0; MAX_LISTED_PROCESSES - 1] };
        let read = unsafe {
            QueryInformationJobObject(
                Some(self.0),
                JobObjectBasicProcessIdList,
                std::ptr::from_mut(&mut list).cast(),
                size_of::<IdList>() as u32,
                None,
            )
        };
        if read.is_err() && list.header.NumberOfProcessIdsInList == 0 {
            return Vec::new();
        }
        let count = (list.header.NumberOfProcessIdsInList as usize).min(MAX_LISTED_PROCESSES);
        std::iter::once(list.header.ProcessIdList[0])
            .chain(list.more.iter().copied())
            .take(count)
            .filter_map(|id| u32::try_from(id).ok())
            .collect()
    }
}

fn process_memory(process_id: u32) -> Option<JobProcess> {
    let process = open_for_limited_query(process_id)?;
    let mut counters = PROCESS_MEMORY_COUNTERS::default();
    unsafe { GetProcessMemoryInfo(process.0, &mut counters, size_of::<PROCESS_MEMORY_COUNTERS>() as u32) }.ok()?;
    let name = image_path(process_id)
        .and_then(|path| path.rsplit(['\\', '/']).next().map(str::to_string))
        .unwrap_or_default();
    Some(JobProcess {
        name,
        private_bytes: counters.PagefileUsage as u64,
        working_set_bytes: counters.WorkingSetSize as u64,
    })
}

impl Drop for Job {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::{Command, Stdio};

    #[test]
    fn a_suspended_process_runs_only_after_it_is_resumed() {
        use std::os::windows::process::CommandExt;
        let job = Job::new().expect("job");
        let mut child = Command::new("cmd")
            .args(["/c", "exit 7"])
            .creation_flags(START_SUSPENDED)
            .spawn()
            .expect("spawn");
        job.assign(&child).expect("assign");
        std::thread::sleep(std::time::Duration::from_millis(300));
        assert!(child.try_wait().expect("wait").is_none(), "suspended until resumed");
        resume(child.id()).expect("resume");
        assert_eq!(child.wait().expect("wait").code(), Some(7));
    }

    #[test]
    fn a_resumed_powershell_answers_on_stdout_like_a_plugin() {
        use std::io::{BufRead, BufReader};
        use std::os::windows::process::CommandExt;
        let job = Job::new().expect("job");
        let mut child = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", "[Console]::Out.WriteLine('ready')"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .creation_flags(START_SUSPENDED)
            .spawn()
            .expect("spawn");
        job.assign(&child).expect("assign");
        resume(child.id()).expect("resume");
        let mut line = String::new();
        BufReader::new(child.stdout.take().expect("stdout")).read_line(&mut line).expect("read");
        assert_eq!(line.trim(), "ready");
        assert!(child.wait().expect("wait").success());
    }

    #[test]
    fn closing_the_job_ends_the_process_tree() {
        let job = Job::new().expect("job");
        let mut child = Command::new("cmd")
            .args(["/c", "ping -n 30 127.0.0.1 >nul"])
            .stdout(Stdio::null())
            .spawn()
            .expect("spawn");
        job.assign(&child).expect("assign");
        std::thread::sleep(std::time::Duration::from_millis(500));
        let ids = job.process_ids();
        assert!(ids.len() >= 2, "cmd and ping are both in the job: {ids:?}");
        let usage = job.usage().expect("usage");
        assert!(usage.memory_bytes > 0);
        assert!(usage.processes.iter().any(|process| process.name.eq_ignore_ascii_case("cmd.exe") && process.working_set_bytes > 0), "{:?}", usage.processes);
        assert_eq!(usage.memory_bytes, usage.processes.iter().map(|process| process.private_bytes).sum::<u64>());
        drop(job);
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        let mut ended = || child_ended(&mut child) && ids.iter().all(|id| !alive(*id));
        while !ended() && std::time::Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        assert!(child.try_wait().expect("wait").is_some(), "cmd ended with the job");
        for id in &ids {
            assert!(!alive(*id), "process {id} ended with the job");
        }
    }

    fn child_ended(child: &mut std::process::Child) -> bool {
        child.try_wait().is_ok_and(|status| status.is_some())
    }

    fn alive(process_id: u32) -> bool {
        let output = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {process_id}"), "/FO", "CSV", "/NH"])
            .output()
            .expect("tasklist");
        let wanted = format!("\"{process_id}\"");
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .any(|line| line.split(',').nth(1) == Some(wanted.as_str()))
    }
}
