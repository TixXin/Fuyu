use tauri::{ActivationPolicy, AppHandle};

pub(super) fn show(app: &AppHandle) {
    set(app, ActivationPolicy::Regular);
    if let Err(error) = app.run_on_main_thread(crate::macos::app_icon::use_own_icon_outside_bundle) {
        eprintln!("failed to set the dock icon image: {error}");
    }
}

pub(super) fn hide(app: &AppHandle) {
    set(app, ActivationPolicy::Accessory);
}

fn set(app: &AppHandle, policy: ActivationPolicy) {
    if let Err(error) = app.set_activation_policy(policy) {
        eprintln!("failed to switch the dock icon for settings: {error}");
    }
}
