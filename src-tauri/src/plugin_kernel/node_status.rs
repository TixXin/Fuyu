use std::sync::{Condvar, Mutex, MutexGuard, OnceLock, PoisonError};

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub(crate) enum NodeStatus {
    Checking,
    Downloading { downloaded: u64, total: Option<u64> },
    Failed { error: String, cause: FailureCause },
    Ready,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum FailureCause {
    Network,
    Disk,
    Other,
}

impl From<plugin_base::FailureCause> for FailureCause {
    fn from(cause: plugin_base::FailureCause) -> Self {
        match cause {
            plugin_base::FailureCause::Network => Self::Network,
            plugin_base::FailureCause::Disk => Self::Disk,
            plugin_base::FailureCause::Other => Self::Other,
        }
    }
}

#[derive(Debug)]
struct Shared {
    status: NodeStatus,
    retry: bool,
    stopping: bool,
}

#[derive(Debug)]
pub(crate) struct NodeGate {
    shared: Mutex<Shared>,
    wake: Condvar,
}

impl Default for NodeGate {
    fn default() -> Self {
        Self { shared: Mutex::new(Shared { status: NodeStatus::Checking, retry: false, stopping: false }), wake: Condvar::new() }
    }
}

impl NodeGate {
    fn lock(&self) -> MutexGuard<'_, Shared> {
        self.shared.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub(crate) fn set(&self, status: NodeStatus) {
        self.lock().status = status;
    }

    pub(crate) fn current(&self) -> NodeStatus {
        self.lock().status.clone()
    }

    pub(crate) fn retry(&self) -> bool {
        let mut shared = self.lock();
        if shared.stopping || !matches!(shared.status, NodeStatus::Failed { .. }) {
            return false;
        }
        shared.status = NodeStatus::Checking;
        shared.retry = true;
        self.wake.notify_all();
        true
    }

    pub(crate) fn wait_for_retry(&self) -> bool {
        let mut shared = self.lock();
        while !shared.retry && !shared.stopping {
            shared = self.wake.wait(shared).unwrap_or_else(PoisonError::into_inner);
        }
        shared.retry = false;
        !shared.stopping
    }

    pub(crate) fn stop(&self) {
        self.lock().stopping = true;
        self.wake.notify_all();
    }
}

static GATE: OnceLock<NodeGate> = OnceLock::new();

pub(crate) fn gate() -> &'static NodeGate {
    GATE.get_or_init(NodeGate::default)
}

pub(crate) fn current() -> Option<NodeStatus> {
    GATE.get().map(NodeGate::current)
}
