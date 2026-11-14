use serde_json::{json, Value};

use super::{current_entry, lock, set_keep_alive, Context};
use crate::plugin_host::{
    events::{event_permission, MAX_SUBSCRIBE},
    dev, feeds, notify, optional, reveal, sensitive, storage, views, webviews, windows,
    permissions::{experimental_method, method_permission, CAPABILITIES},
    rpc,
    settings::parse_info,
};
use crate::{agent_status, clipboard_history, file_shelf, local_api, media_control};

pub(super) fn initialize_params(context: &Context) -> Value {
    let spec = &context.spec;
    let mut params = json!({
        "apiVersion": spec.api_version,
        "capabilities": if spec.api_version >= 2 { &CAPABILITIES[..] } else { &[] },
        "appVersion": spec.app_version,
        "pluginId": spec.plugin_id,
        "dataDir": spec.data_dir.display().to_string(),
        "permissions": optional::usable(&spec.plugin_id, &spec.granted, &spec.optional),
        "settings": *lock(&context.settings),
    });
    if spec.api_version >= 2 {
        params["activationEvent"] = json!(spec.activation_event);
        params["optionalPermissions"] = json!(spec.optional);
    }
    if !spec.experimental_apis.is_empty() {
        params["experimentalApis"] = json!(dev::granted_experimental(&spec.experimental_apis));
    }
    params
}

pub(super) fn answer_request(context: &Context, id: &Value, method: &str, params: Value) -> String {
    match method {
        "host.info" => return rpc::result_line(id, initialize_params(context)),
        "settings.get" => return rpc::result_line(id, Value::Object(lock(&context.settings).clone())),
        "ui.setInfo" => {
            return match parse_info(&params) {
                Ok(items) => {
                    let mut table = lock(&context.table);
                    if let Some(info) = current_entry(context, &mut table) {
                        info.info = items;
                    }
                    rpc::result_line(id, json!({}))
                }
                Err(message) => rpc::error_line(id, rpc::HOST_ERROR, &message, Some(json!({ "status": 400 }))),
            };
        }
        "events.subscribe" | "events.unsubscribe" if context.spec.api_version >= 2 => {
            return change_subscriptions(context, id, method == "events.subscribe", &params);
        }
        "host.keepAlive" if context.spec.api_version >= 2 => {
            return answer(id, keep_alive(context, &params));
        }
        "view.update" | "view.patch" | "status.update" if context.spec.api_version >= 2 => {
            return answer(id, views::answer(&context.app, &context.spec.plugin_id, method, &params));
        }
        "webview.postMessage" if context.spec.api_version >= 2 => {
            return answer(id, webviews::post_from_plugin(&context.app, &context.spec.plugin_id, &params));
        }
        "storage.get" | "storage.set" | "storage.delete" | "storage.keys" if context.spec.api_version >= 2 => {
            return answer(id, storage::answer_storage(&context.spec.data_dir, method, &params));
        }
        "settings.set" if context.spec.api_version >= 2 => {
            return answer(id, set_own_settings(context, &params));
        }
        "island.openView" if context.spec.api_version >= 2 => {
            return answer(id, reveal::open_view(&context.app, &context.spec.plugin_id, &params));
        }
        "permissions.request" if context.spec.api_version >= 2 => {
            let spec = &context.spec;
            return answer(id, optional::request(&context.app, &spec.plugin_id, &spec.granted, &spec.optional, &params));
        }
        _ => {}
    }
    if let Some((permission, api)) = experimental_method(method) {
        return answer_experimental(context, id, method, permission, api, &params);
    }
    let Some((name, permission)) = method_permission(method) else {
        return rpc::error_line(id, rpc::METHOD_NOT_FOUND, &format!("Unknown method \"{method}\"."), None);
    };
    if let Some(message) = missing_permission(context, permission) {
        return rpc::error_line(id, rpc::PERMISSION_DENIED, &message, None);
    }
    if sensitive::is_sensitive(permission) && !sensitive::check(&context.app, &context.spec.plugin_id, permission) {
        let message = format!("The user did not allow the \"{permission}\" permission.");
        return rpc::error_line(id, rpc::PERMISSION_DENIED, &message, None);
    }
    let owner = &context.spec.plugin_id;
    let result = match name {
        "agentStatus.report" => agent_status::report_external_status(owner, &context.spec.display_name, &params),
        "agentStatus.clear" => agent_status::clear_external_status(owner, &params),
        "island.notify" => notify::show(&context.app, owner, &params),
        "secrets.get" | "secrets.set" | "secrets.delete" => storage::answer_secret(owner, name, &params),
        "clipboard.history" => clipboard_history::plugin_history(&params),
        "messages.list" => feeds::messages_list(),
        "media.nowPlaying" => media_control::plugin_now_playing(),
        "media.cover" => media_control::plugin_cover(),
        "media.playPause" | "media.next" | "media.previous" | "media.seek" | "media.setVolume" | "media.toggleShuffle" | "media.cycleRepeat" => {
            media_control::plugin_media_command(name, &params)
        }
        "shelf.list" => file_shelf::plugin_shelf_list(),
        "shelf.add" => file_shelf::plugin_shelf_add(&context.app, &params),
        "shelf.remove" => file_shelf::plugin_shelf_remove(&context.app, &params),
        _ => local_api::call_island(&context.app, name, params),
    };
    answer(id, result)
}

fn answer_experimental(context: &Context, id: &Value, method: &str, permission: &str, api: &str, params: &Value) -> String {
    let spec = &context.spec;
    if !dev::granted_experimental(&spec.experimental_apis).iter().any(|name| name == api) {
        let message = format!("\"{method}\" is experimental: list \"{api}\" in experimentalApis and load the plugin in development mode (Windows only for now).");
        return rpc::error_line(id, rpc::METHOD_NOT_FOUND, &message, None);
    }
    if let Some(message) = missing_permission(context, permission) {
        return rpc::error_line(id, rpc::PERMISSION_DENIED, &message, None);
    }
    let caller = windows::Caller { app: &context.app, plugin_id: &spec.plugin_id, display_name: &spec.display_name };
    answer(id, windows::answer(caller, method, params))
}

fn missing_permission(context: &Context, permission: &str) -> Option<String> {
    let spec = &context.spec;
    if optional::has(&spec.plugin_id, &spec.granted, &spec.optional, permission) {
        return None;
    }
    Some(if spec.optional.iter().any(|name| name == permission) {
        format!("The user has not allowed the optional \"{permission}\" permission; ask with permissions.request first.")
    } else {
        format!("The plugin was not given the \"{permission}\" permission.")
    })
}

fn answer(id: &Value, answer: Result<Value, (u16, String)>) -> String {
    match answer {
        Ok(result) => rpc::result_line(id, result),
        Err((status, message)) => rpc::error_line(id, rpc::HOST_ERROR, &message, Some(json!({ "status": status }))),
    }
}

fn change_subscriptions(context: &Context, id: &Value, subscribe: bool, params: &Value) -> String {
    let bad_params = |message: &str| rpc::error_line(id, rpc::HOST_ERROR, message, Some(json!({ "status": 400 })));
    let Some(requested) = params.get("events").and_then(Value::as_array) else {
        return bad_params("Expected { events: [string] }.");
    };
    if requested.len() > MAX_SUBSCRIBE {
        return bad_params(&format!("At most {MAX_SUBSCRIBE} events at once."));
    }
    let mut names = Vec::with_capacity(requested.len());
    for value in requested {
        let Some(text) = value.as_str() else {
            return bad_params("Event names must be strings.");
        };
        let Some((name, permission)) = event_permission(text) else {
            return bad_params(&format!("Unknown event \"{text}\"."));
        };
        if let Some(permission) = permission.filter(|_| subscribe) {
            if let Some(why) = missing_permission(context, permission) {
                let message = format!("The \"{name}\" event needs the \"{permission}\" permission. {why}");
                return rpc::error_line(id, rpc::PERMISSION_DENIED, &message, None);
            }
            if sensitive::is_sensitive(permission) && !sensitive::check(&context.app, &context.spec.plugin_id, permission) {
                let message = format!("The user did not allow the \"{permission}\" permission.");
                return rpc::error_line(id, rpc::PERMISSION_DENIED, &message, None);
            }
        }
        names.push(name);
    }
    let answer = {
        let mut subscriptions = lock(&context.subscriptions);
        for name in names.iter().copied() {
            if subscribe {
                subscriptions.insert(name);
            } else {
                subscriptions.remove(name);
            }
        }
        rpc::result_line(id, json!({ "events": *subscriptions }))
    };
    if subscribe && names.contains(&"media.changed") {
        feeds::watch_media();
    }
    answer
}

fn set_own_settings(context: &Context, params: &Value) -> Result<Value, (u16, String)> {
    let values = params
        .get("values")
        .and_then(Value::as_object)
        .filter(|values| !values.is_empty())
        .ok_or((400, "Expected { values: { key: value } } with at least one setting.".to_string()))?;
    let resolved = crate::plugin_host::commands::store_settings(&context.spec.plugin_id, values).map_err(|error| (400, error))?;
    *lock(&context.settings) = resolved.clone();
    Ok(json!({ "settings": resolved }))
}

fn keep_alive(context: &Context, params: &Value) -> Result<Value, (u16, String)> {
    let reason = match params.get("reason") {
        None | Some(Value::Null) => None,
        Some(Value::String(text)) if (1..=100).contains(&text.trim().chars().count()) => Some(text.trim().to_string()),
        Some(_) => return Err((400, "\"reason\" must be 1-100 characters, or null to let the plugin stop when idle.".into())),
    };
    set_keep_alive(context, reason);
    Ok(json!({}))
}
