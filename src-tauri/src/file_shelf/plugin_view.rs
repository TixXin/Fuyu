use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::{add_paths, is_enabled, service, FileShelfSnapshot};
use crate::island;

pub(super) const CHANGED_EVENT: &str = "file-shelf-changed";
pub(super) const MAX_PATHS: usize = 20;
const TURNED_OFF: &str = "The file shelf is turned off.";

fn answer(snapshot: Result<FileShelfSnapshot, String>) -> Result<Value, (u16, String)> {
    snapshot.map(|snapshot| json!(snapshot)).map_err(|error| (500, error))
}

pub(super) fn strings(params: &Value, key: &str) -> Result<Vec<String>, (u16, String)> {
    let bad = || (400, format!("\"{key}\" must be a list of 1-{MAX_PATHS} strings."));
    let list = params.get(key).and_then(Value::as_array).filter(|list| (1..=MAX_PATHS).contains(&list.len())).ok_or_else(bad)?;
    list.iter().map(|value| value.as_str().map(str::to_string).ok_or_else(bad)).collect()
}

fn turned_on() -> Result<(), (u16, String)> {
    if is_enabled() {
        Ok(())
    } else {
        Err((503, TURNED_OFF.to_string()))
    }
}

pub(crate) fn plugin_shelf_list() -> Result<Value, (u16, String)> {
    turned_on()?;
    answer(service().and_then(|service| service.update(|items| items)))
}

pub(crate) fn plugin_shelf_add(app: &AppHandle, params: &Value) -> Result<Value, (u16, String)> {
    turned_on()?;
    let paths = strings(params, "paths")?;
    service().map_err(|error| (503, error))?;
    let result = answer(add_paths(&paths));
    let _ = app.emit_to(island::WINDOW_LABEL, CHANGED_EVENT, ());
    result
}

pub(crate) fn plugin_shelf_remove(app: &AppHandle, params: &Value) -> Result<Value, (u16, String)> {
    turned_on()?;
    let ids = strings(params, "ids")?;
    let result = answer(service().and_then(|service| {
        service.update(|mut items| {
            items.retain(|item| !ids.contains(&item.id));
            items
        })
    }));
    let _ = app.emit_to(island::WINDOW_LABEL, CHANGED_EVENT, ());
    result
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{strings, MAX_PATHS};

    #[test]
    fn plugin_lists_must_be_short_lists_of_strings() {
        assert_eq!(strings(&json!({ "paths": ["C:\\a", "D:\\b"] }), "paths").expect("ok"), vec!["C:\\a", "D:\\b"]);
        for bad in [json!({}), json!({ "paths": [] }), json!({ "paths": "C:\\a" }), json!({ "paths": [1] })] {
            assert_eq!(strings(&bad, "paths").expect_err("bad").0, 400);
        }
        let many: Vec<String> = (0..=MAX_PATHS).map(|n| format!("C:\\{n}")).collect();
        assert!(strings(&json!({ "ids": many }), "ids").is_err());
    }
}
