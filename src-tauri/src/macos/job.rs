use std::process::Child;

pub(crate) const START_SUSPENDED: u32 = 0;

pub(crate) fn resume(_process_id: u32) -> Result<(), String> {
    Ok(())
}

pub(crate) struct Job;

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
        Ok(Self)
    }

    pub(crate) fn assign(&self, _child: &Child) -> Result<(), String> {
        Ok(())
    }

    pub(crate) fn usage(&self) -> Option<JobUsage> {
        None
    }
}
