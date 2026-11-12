use serde_json::{json, Value};
use tauri::AppHandle;

use super::{permissions::PERMISSIONS, sensitive};

pub(super) fn has(plugin_id: &str, granted: &[String], optional: &[String], permission: &str) -> bool {
    granted.iter().any(|name| name == permission) || optional.iter().any(|name| name == permission) && sensitive::allowed_now(plugin_id, permission)
}

pub(super) fn usable(plugin_id: &str, granted: &[String], optional: &[String]) -> Vec<String> {
    let mut usable = granted.to_vec();
    usable.extend(optional.iter().filter(|name| sensitive::allowed_now(plugin_id, name)).cloned());
    usable.sort();
    usable.dedup();
    usable
}

pub(super) fn requested<'a>(params: &'a Value, granted: &[String], optional: &[String]) -> Result<Vec<&'a str>, (u16, String)> {
    let bad = |message: String| (400, message);
    let names = params
        .get("permissions")
        .and_then(Value::as_array)
        .filter(|names| !names.is_empty() && names.len() <= PERMISSIONS.len())
        .ok_or_else(|| bad(format!("Expected {{ permissions: [name] }} with 1-{} names.", PERMISSIONS.len())))?;
    let mut list = Vec::with_capacity(names.len());
    for name in names {
        let name = name.as_str().ok_or_else(|| bad("Permission names must be strings.".into()))?;
        if !granted.iter().chain(optional).any(|listed| listed == name) {
            return Err(bad(format!("\"{name}\" is not in the plugin's permissions or optionalPermissions.")));
        }
        if !list.contains(&name) {
            list.push(name);
        }
    }
    Ok(list)
}

pub(super) fn request(app: &AppHandle, plugin_id: &str, granted: &[String], optional: &[String], params: &Value) -> Result<Value, (u16, String)> {
    let mut allowed = Vec::new();
    let mut denied = Vec::new();
    for name in requested(params, granted, optional)? {
        let Some(permission) = PERMISSIONS.iter().copied().find(|known| *known == name) else { continue };
        let yes = granted.iter().any(|listed| listed == name) && !sensitive::is_sensitive(permission)
            || sensitive::check(app, plugin_id, permission);
        if yes {
            allowed.push(permission);
        } else {
            denied.push(permission);
        }
    }
    Ok(json!({ "granted": allowed, "denied": denied }))
}
