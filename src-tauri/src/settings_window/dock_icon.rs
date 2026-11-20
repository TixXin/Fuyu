use tauri::{ActivationPolicy, AppHandle};

pub(super) fn show(app: &AppHandle) {
    crate::app_identity::before_dock_icon(app);
    set(app, ActivationPolicy::Regular);
    crate::app_identity::after_dock_icon(app);
}

pub(super) fn hide(app: &AppHandle) {
    set(app, ActivationPolicy::Accessory);
}

fn set(app: &AppHandle, policy: ActivationPolicy) {
    if let Err(error) = app.set_activation_policy(policy) {
        eprintln!("failed to switch the dock icon for settings: {error}");
    }
}
