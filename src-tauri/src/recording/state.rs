use serde::Serialize;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Phase {
    #[default]
    Idle,
    Countdown,
    Recording,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct State {
    pub(crate) phase: Phase,
    pub(crate) countdown: u32,
    pub(crate) paused: bool,
    pub(crate) elapsed_ms: u64,
    pub(crate) since_ms: u64,
}

impl State {
    pub(crate) fn counting(seconds: u32) -> Self {
        Self { phase: Phase::Countdown, countdown: seconds, ..Self::default() }
    }

    pub(crate) fn recording(now_ms: u64) -> Self {
        Self { phase: Phase::Recording, since_ms: now_ms, ..Self::default() }
    }

    pub(crate) fn paused(&self, paused: bool, now_ms: u64) -> Self {
        if self.phase != Phase::Recording || self.paused == paused {
            return self.clone();
        }
        if paused {
            Self { paused, elapsed_ms: self.elapsed_ms + now_ms.saturating_sub(self.since_ms), ..self.clone() }
        } else {
            Self { paused, since_ms: now_ms, ..self.clone() }
        }
    }
}
