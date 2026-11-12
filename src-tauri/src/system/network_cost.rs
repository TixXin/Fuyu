use windows::Networking::Connectivity::{NetworkCostType, NetworkInformation};

#[tauri::command]
pub fn updater_metered() -> bool {
    let Ok(profile) = NetworkInformation::GetInternetConnectionProfile() else { return false };
    let Ok(cost) = profile.GetConnectionCost() else { return false };
    let metered = cost.NetworkCostType().is_ok_and(|kind| kind == NetworkCostType::Fixed || kind == NetworkCostType::Variable);
    metered || cost.Roaming().unwrap_or(false) || cost.OverDataLimit().unwrap_or(false)
}
