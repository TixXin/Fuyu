use tauri::{ActivationPolicy, AppHandle};

pub(super) fn show(app: &AppHandle) {
    set(app, ActivationPolicy::Regular);
}

pub(super) fn hide(app: &AppHandle) {
    set(app, ActivationPolicy::Accessory);
}

fn set(app: &AppHandle, policy: ActivationPolicy) {
    if let Err(error) = app.set_activation_policy(policy) {
        eprintln!("failed to switch the dock icon for settings: {error}");
    }
}
