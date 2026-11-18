use super::service;
use crate::agent_status::host_icon;
use crate::macos::apps;

fn resolve_app_path(source_app: &str) -> Option<String> {
    if let Some(path) = apps::path_for_bundle_id(source_app) {
        return Some(path);
    }
    let needle = source_app
        .strip_suffix(".exe")
        .or_else(|| source_app.strip_suffix(".app"))
        .unwrap_or(source_app)
        .to_lowercase();
    if needle.is_empty() {
        return None;
    }
    for (_, exe_path) in apps::regular_apps() {
        if let Some(app_name) = apps::outer_app_name(&exe_path) {
            if app_name.to_lowercase().contains(&needle) {
                if let Some(bundle_end) = exe_path.find(".app/") {
                    return Some(exe_path[..bundle_end + 4].to_string());
                }
                return Some(exe_path);
            }
        }
    }
    None
}

pub(crate) fn current_source_icon() -> Option<String> {
    let source_app = service::get_state(None).ok()?.source_app?;
    let path = resolve_app_path(&source_app)?;
    host_icon::icon_data_url(&path)
}
