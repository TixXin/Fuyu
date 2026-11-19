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

impl Job {
    pub(crate) fn new() -> Result<Self, String> {
        Ok(Self { group: AtomicI32::new(0) })
    }

    pub(crate) fn assign(&self, child: &Child) -> Result<(), String> {
        let group = i32::try_from(child.id()).map_err(|error| error.to_string())?;
        self.group.store(group, Ordering::SeqCst);
        Ok(())
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
        drop(job);
        let _ = child.wait();
        thread::sleep(Duration::from_millis(100));
        assert!(!alive(grandchild), "the plugin's own children go too");
    }
}
