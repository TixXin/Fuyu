use std::{
    panic::{self, AssertUnwindSafe},
    sync::{mpsc, Arc},
    time::{Duration, Instant},
};

use super::service::{worker, MailService, Work, WorkerExit};

const MAX_CRASHES: usize = 3;
const CRASH_WINDOW: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, Default)]
pub(super) struct RestartPolicy {
    crashes: Vec<Instant>,
}

impl RestartPolicy {
    pub(super) fn allow_restart(&mut self, now: Instant) -> bool {
        self.crashes
            .retain(|crash| now.saturating_duration_since(*crash) < CRASH_WINDOW);
        self.crashes.push(now);
        self.crashes.len() <= MAX_CRASHES
    }
}

pub(super) fn supervise(
    service: Arc<MailService>,
    receiver: mpsc::Receiver<Work>,
    is_current: impl Fn(&Arc<MailService>) -> bool,
) {
    let mut policy = RestartPolicy::default();
    loop {
        let exit = panic::catch_unwind(AssertUnwindSafe(|| worker(service.clone(), &receiver)));
        if matches!(exit, Ok(WorkerExit::Stopped)) || !is_current(&service) {
            return;
        }
        let restart = policy.allow_restart(Instant::now());
        service.recover_after_crash(restart);
        if !restart {
            return;
        }
    }
}
