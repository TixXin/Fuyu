//! Whether this computer's internet connection is metered (a phone hotspot, a capped plan), so
//! the island does not download an update over it by itself (task D18).

use windows::Networking::Connectivity::{NetworkCostType, NetworkInformation};

/// True on a metered, roaming or over-limit connection; false when unknown or offline.
#[tauri::command]
pub fn updater_metered() -> bool {
    let Ok(profile) = NetworkInformation::GetInternetConnectionProfile() else { return false };
    let Ok(cost) = profile.GetConnectionCost() else { return false };
    let metered = cost.NetworkCostType().is_ok_and(|kind| kind == NetworkCostType::Fixed || kind == NetworkCostType::Variable);
    metered || cost.Roaming().unwrap_or(false) || cost.OverDataLimit().unwrap_or(false)
}
