mod apps;
mod battery;
mod launch;
mod stats;

use std::{
    sync::{Mutex, PoisonError},
    time::{Duration, Instant},
};

use serde::Serialize;

use crate::platform::{power, system_stats};
use crate::user_error::UserError;
pub use battery::Battery;
use stats::{cpu_share, network_rate, Counters};

const MIN_SPAN: Duration = Duration::from_millis(500);

struct Sample {
    at: Instant,
    cpu: Option<(u64, u64)>,
    network: Counters,
    rates: (Option<f32>, Option<Network>),
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
pub struct SystemStats {
    cpu: Option<f32>,
    memory: Option<Memory>,
    network: Option<Network>,
    battery: Option<Battery>,
}

fn read_stats() -> SystemStats {
    let mut last = LAST.lock().unwrap_or_else(PoisonError::into_inner);
    let (cpu, network) = match last.as_ref() {
        Some(before) if before.at.elapsed() < MIN_SPAN => before.rates,
        _ => {
            let now = Sample {
                at: Instant::now(),
                cpu: system_stats::cpu_times(),
                network: system_stats::network_counters().into_iter().map(|(name, received, sent)| (name, (received, sent))).collect(),
                rates: (None, None),
            };
            let rates = match last.as_ref() {
                Some(before) => (
                    before.cpu.zip(now.cpu).and_then(|(before, after)| cpu_share(before, after)),
                    network_rate(&before.network, &now.network, now.at.duration_since(before.at).as_secs_f64()).map(|(down, up)| Network { down, up }),
                ),
                None => (None, None),
            };
            *last = Some(Sample { rates, ..now });
            rates
        }
    };
    SystemStats {
        cpu,
        memory: system_stats::memory().map(|(used, total)| Memory { used, total }),
        network,
        battery: power::power_source().map(battery::evaluate),
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

#[tauri::command]
pub async fn quick_app_info(path: String) -> Result<apps::QuickAppInfo, UserError> {
    apps::info(&path).ok_or_else(|| UserError::new("quickLaunch.notApp", "This isn't an app that can be opened.").arg("path", path))
}

#[tauri::command]
pub async fn launch_quick_app_path(path: String) -> Result<(), UserError> {
    if !apps::is_app(&path) {
        return Err(UserError::new("quickLaunch.notApp", "This isn't an app that can be opened.").arg("path", path));
    }
    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|error| UserError::new("quickLaunch.failed", "Could not open the program.").detail(error.to_string()))
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::system_widgets::get_system_stats,
            crate::system_widgets::launch_quick_app,
            crate::system_widgets::quick_app_info,
            crate::system_widgets::launch_quick_app_path,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
