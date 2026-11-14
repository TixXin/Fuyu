use std::{
    process::{Child, Command},
    sync::Arc,
};

use plugin_base::Containment;

use crate::{
    platform::job::{self, Job},
    system::{CommandExt, CREATE_NO_WINDOW},
};

struct JobContainment;

impl Containment for JobContainment {
    fn prepare(&self, command: &mut Command) {
        command.creation_flags(CREATE_NO_WINDOW | job::START_SUSPENDED);
        #[cfg(unix)]
        std::os::unix::process::CommandExt::process_group(command, 0);
    }

    fn adopt(&self, child: &Child) -> Result<Box<dyn Send>, String> {
        let job = Job::new()?;
        job.assign(child)?;
        job::resume(child.id())?;
        Ok(Box::new(job))
    }
}

pub(super) fn shared() -> Arc<dyn Containment> {
    Arc::new(JobContainment)
}
