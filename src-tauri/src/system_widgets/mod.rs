mod launch;
mod stats;

use std::{
    sync::{Mutex, PoisonError},
    time::Instant,
};

use serde::Serialize;

use crate::platform::{power, system_stats};
use crate::user_error::UserError;
use stats::{cpu_share, network_rate, Counters};

struct Sample {
    at: Instant,
    cpu: Option<(u64, u64)>,
    network: Counters,
}

static LAST: Mutex<Option<Sample>> = Mutex::new(None);

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    used: u64,
    total: u64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Network {
    down: f64,
    up: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Battery {
    level: Option<u8>,
    plugged_in: bool,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    cpu: Option<f32>,
    memory: Option<Memory>,
    network: Option<Network>,
    battery: Option<Battery>,
}

fn read_stats() -> SystemStats {
    let now = Sample {
        at: Instant::now(),
        cpu: system_stats::cpu_times(),
        network: system_stats::network_counters().into_iter().map(|(name, received, sent)| (name, (received, sent))).collect(),
    };
    let mut last = LAST.lock().unwrap_or_else(PoisonError::into_inner);
    let (cpu, network) = match last.as_ref() {
        Some(before) => (
            before.cpu.zip(now.cpu).and_then(|(before, after)| cpu_share(before, after)),
            network_rate(&before.network, &now.network, now.at.duration_since(before.at).as_secs_f64()).map(|(down, up)| Network { down, up }),
        ),
        None => (None, None),
    };
    *last = Some(now);
    SystemStats {
        cpu,
        memory: system_stats::memory().map(|(used, total)| Memory { used, total }),
        network,
        battery: power::power_source().map(|source| Battery { level: source.battery, plugged_in: source.plugged_in }),
    }
}

#[tauri::command]
pub async fn get_system_stats() -> SystemStats {
    read_stats()
}

#[tauri::command]
pub async fn launch_quick_app(target: String) -> Result<(), UserError> {
    if !launch::is_target(&target) {
        return Err(UserError::new("quickLaunch.target", "Unknown quick launch item.").arg("target", target));
    }
    launch::launch(&target).map_err(|error| UserError::new("quickLaunch.failed", "Could not open the program.").detail(error))
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::system_widgets::get_system_stats,
            crate::system_widgets::launch_quick_app,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
