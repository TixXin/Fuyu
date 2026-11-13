use serde_json::Value;
use tauri::AppHandle;

use super::routes::{body_object, ApiCall, ApiError};

pub(super) const EMIT: &str = "devIsland.emit";
pub(super) const ACTION: &str = "devIsland.action";
pub(super) const NOTCH: &str = "devIsland.notch";

pub(super) fn route(method: &str, segments: &[&str], body: &[u8]) -> Option<Result<ApiCall, ApiError>> {
    let call = |name: &'static str, params: Result<Value, ApiError>| {
        params.map(|params| ApiCall { method: name, params, writes: false })
    };
    match (method, segments) {
        ("POST", ["v1", "dev", "island", "emit"]) => Some(call(EMIT, body_object(body))),
        ("POST", ["v1", "dev", "island", "action"]) => Some(call(ACTION, body_object(body))),
        ("PUT", ["v1", "dev", "island", "notch"]) => Some(call(NOTCH, body_object(body))),
        ("DELETE", ["v1", "dev", "island", "notch"]) => Some(call(NOTCH, Ok(Value::Null))),
        (_, ["v1", "dev", "island", "emit" | "action" | "notch"]) => {
            Some(Err(ApiError::new(405, "Method not allowed for this path.")))
        }
        _ => None,
    }
}

pub(super) fn set_notch(app: &AppHandle, params: &Value) -> Result<Value, ApiError> {
    let size = if params.is_null() {
        None
    } else {
        let read = |key: &str| params.get(key).and_then(Value::as_f64).filter(|value| value.is_finite() && *value > 0.0);
        match (read("width"), read("height")) {
            (Some(width), Some(height)) => Some((width.min(600.0), height.min(80.0))),
            _ => return Err(ApiError::new(400, "Give width and height in points, both above 0.")),
        }
    };
    crate::island::set_dev_notch(app, size).map_err(|error| ApiError::new(503, error))?;
    Ok(serde_json::json!({ "notch": size.map(|(width, height)| serde_json::json!({ "width": width, "height": height })) }))
}
