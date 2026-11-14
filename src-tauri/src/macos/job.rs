use std::{
    process::Child,
    sync::atomic::{AtomicI32, Ordering},
};

pub(crate) const START_SUSPENDED: u32 = 0;

pub(crate) fn resume(_process_id: u32) -> Result<(), String> {
    Ok(())
}

pub(crate) struct Job {
    group: AtomicI32,
}

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
        Ok(Self { group: AtomicI32::new(0) })
    }

    pub(crate) fn assign(&self, child: &Child) -> Result<(), String> {
        let group = i32::try_from(child.id()).map_err(|error| error.to_string())?;
        self.group.store(group, Ordering::SeqCst);
        Ok(())
    }

    pub(crate) fn usage(&self) -> Option<JobUsage> {
        let group = u32::try_from(self.group.load(Ordering::SeqCst)).ok().filter(|group| *group > 0)?;
        let mut members: Vec<u32> = super::proc_info::all_pids()
            .into_iter()
            .filter(|pid| super::proc_info::process_group(*pid) == Some(group))
            .collect();
        members.sort_by_key(|pid| (*pid != group, *pid));
        let processes: Vec<(String, u64, u64)> = members
            .into_iter()
            .filter_map(|pid| {
                Some((
                    super::proc_info::name(pid)?,
                    super::proc_info::resident_bytes(pid)?,
                    super::proc_info::cpu_time_100ns(pid).unwrap_or(0),
                ))
            })
            .collect();
        if processes.is_empty() {
            return None;
        }
        Some(JobUsage {
            memory_bytes: processes.iter().map(|(_, bytes, _)| bytes).sum(),
            cpu_ticks: processes.iter().map(|(_, _, ticks)| ticks).sum(),
            processes: processes
                .into_iter()
                .map(|(name, bytes, _)| JobProcess { name, private_bytes: bytes, working_set_bytes: bytes })
                .collect(),
        })
    }
}

impl Drop for Job {
    fn drop(&mut self) {
        let group = self.group.load(Ordering::SeqCst);
        if group > 0 {
            unsafe { libc::killpg(group, libc::SIGKILL) };
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{os::unix::process::CommandExt, process::Command, thread, time::Duration};

    use super::Job;

    fn alive(pid: i32) -> bool {
        unsafe { libc::kill(pid, 0) == 0 }
    }

    #[test]
    fn dropping_the_job_ends_the_whole_process_group() {
        let mut child = Command::new("/bin/sh").args(["-c", "sleep 30 & echo $!; wait"]).stdout(std::process::Stdio::piped()).process_group(0).spawn().unwrap();
        let mut line = String::new();
        std::io::BufRead::read_line(&mut std::io::BufReader::new(child.stdout.take().unwrap()), &mut line).unwrap();
        let grandchild: i32 = line.trim().parse().unwrap();
        let job = Job::new().unwrap();
        job.assign(&child).unwrap();
        assert!(job.usage().is_some_and(|usage| usage.processes.len() >= 2));
        drop(job);
        let _ = child.wait();
        thread::sleep(Duration::from_millis(100));
        assert!(!alive(grandchild), "the plugin's own children go too");
    }

    #[test]
    fn the_group_leader_comes_first_and_busy_work_counts_as_cpu_time() {
        let mut child = Command::new("/bin/sh").args(["-c", "sleep 30 & i=0; while [ $i -lt 200000 ]; do i=$((i+1)); done; wait"]).process_group(0).spawn().unwrap();
        let job = Job::new().unwrap();
        job.assign(&child).unwrap();
        thread::sleep(Duration::from_millis(300));
        let usage = job.usage().unwrap();
        assert_ne!(usage.processes[0].name, "sleep");
        assert!((100_000..20_000_000).contains(&usage.cpu_ticks), "{}", usage.cpu_ticks);
        drop(job);
        let _ = child.wait();
    }

    #[test]
    fn mach_time_turns_into_hundreds_of_nanoseconds() {
        assert_eq!(super::super::proc_info::mach_to_100ns(1_000, (1, 1)), 10);
        assert_eq!(super::super::proc_info::mach_to_100ns(24_000_000, (125, 3)), 10_000_000);
    }
}
