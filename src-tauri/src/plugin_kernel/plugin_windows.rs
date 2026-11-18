use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc, Arc, Mutex, MutexGuard, OnceLock, PoisonError,
    },
    thread,
};

use plugin_base::{host_service, ServeError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, Position, Size, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

pub(crate) const MAX_PER_PLUGIN: usize = 8;
pub(crate) const MAX_TOTAL: usize = 24;
pub(crate) const WINDOW_PREFIX: &str = "plugin-window-";
const MIN_SIDE: f64 = 48.0;
const MAX_SIDE: f64 = 4096.0;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, ts(rename_all = "camelCase"))]
pub(crate) struct PluginWindowOpenSpec {
    pub plugin_id: String,
    pub window_id: String,
    pub kind: String,
    #[serde(default)]
    #[cfg_attr(test, ts(optional = nullable))]
    pub title: Option<String>,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    #[cfg_attr(test, ts(optional = nullable))]
    pub x: Option<f64>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional = nullable))]
    pub y: Option<f64>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional = nullable))]
    pub always_on_top: Option<bool>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional = nullable))]
    pub resizable: Option<bool>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional = nullable))]
    pub visible: Option<bool>,
    #[serde(default)]
    #[cfg_attr(test, ts(optional = nullable))]
    pub click_through: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, ts(rename_all = "camelCase"))]
pub(crate) struct PluginWindowInfo {
    pub plugin_id: String,
    pub window_id: String,
    pub label: String,
    pub kind: String,
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub visible: bool,
    pub focused: bool,
    pub always_on_top: bool,
    pub resizable: bool,
    pub click_through: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, ts(rename_all = "camelCase"))]
pub(crate) struct PluginWindowList {
    pub windows: Vec<PluginWindowInfo>,
}

#[derive(Debug, Clone)]
pub(super) struct CreateWindow {
    pub plugin_id: String,
    pub window_id: String,
    pub label: String,
    pub kind: String,
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub visible: bool,
    pub always_on_top: bool,
    pub resizable: bool,
    pub click_through: bool,
}

#[derive(Debug, Clone, Default)]
pub(super) struct WindowPatch {
    pub title: Option<String>,
    pub size: Option<(f64, f64)>,
    pub position: Option<(f64, f64)>,
    pub always_on_top: Option<bool>,
    pub resizable: Option<bool>,
    pub click_through: Option<bool>,
}

#[derive(Debug, Clone, Default)]
pub(super) struct ControlRequest {
    pub plugin_id: String,
    pub window_id: Option<String>,
    pub action: String,
    pub title: Option<String>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub always_on_top: Option<bool>,
    pub resizable: Option<bool>,
    pub click_through: Option<bool>,
}

pub(super) trait WindowDriver: Send + Sync {
    fn exists(&self, label: &str) -> bool;
    fn create(&self, spec: &CreateWindow) -> Result<(), String>;
    fn update(&self, label: &str, patch: &WindowPatch) -> Result<(), String>;
    fn show(&self, label: &str) -> Result<(), String>;
    fn hide(&self, label: &str) -> Result<(), String>;
    fn focus(&self, label: &str) -> Result<(), String>;
    fn close(&self, label: &str);
}

#[derive(Debug, Clone)]
struct Entry {
    info: PluginWindowInfo,
    creating: bool,
}

pub(super) struct WindowManager {
    entries: Mutex<BTreeMap<(String, String), Entry>>,
    next_id: AtomicU64,
}

impl Default for WindowManager {
    fn default() -> Self {
        Self::new()
    }
}

impl WindowManager {
    pub(super) fn new() -> Self {
        Self {
            entries: Mutex::new(BTreeMap::new()),
            next_id: AtomicU64::new(1),
        }
    }

    fn lock(&self) -> MutexGuard<'_, BTreeMap<(String, String), Entry>> {
        self.entries.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub(super) fn open(&self, driver: &dyn WindowDriver, spec: PluginWindowOpenSpec) -> Result<PluginWindowInfo, ServeError> {
        let plugin_id = spec.plugin_id.trim().to_owned();
        let window_id = spec.window_id.trim().to_owned();
        let kind = spec.kind.trim().to_owned();
        if plugin_id.is_empty() {
            return Err(ServeError::bad_params("pluginKernel.windowOpen", "pluginId must not be empty"));
        }
        if window_id.is_empty() {
            return Err(ServeError::bad_params("pluginKernel.windowOpen", "windowId must not be empty"));
        }
        if kind != "widget" && kind != "overlay" {
            return Err(ServeError::bad_params("pluginKernel.windowOpen", "kind must be widget or overlay"));
        }
        let width = check_side("pluginKernel.windowOpen", "width", spec.width)?;
        let height = check_side("pluginKernel.windowOpen", "height", spec.height)?;
        check_coord("pluginKernel.windowOpen", "x", spec.x)?;
        check_coord("pluginKernel.windowOpen", "y", spec.y)?;
        if spec.x.is_some() != spec.y.is_some() {
            return Err(ServeError::bad_params("pluginKernel.windowOpen", "x and y must be provided together"));
        }

        let title = spec.title.unwrap_or_else(|| plugin_id.clone());
        let visible = spec.visible.unwrap_or(true);
        let always_on_top = spec.always_on_top.unwrap_or(false);
        let resizable = spec.resizable.unwrap_or(false);
        let click_through = spec.click_through.unwrap_or(false);
        let focused = kind == "overlay" && visible;
        let pair = (plugin_id.clone(), window_id.clone());

        let (label, reusing) = {
            let mut entries = self.lock();
            if let Some(existing) = entries.get(&pair) {
                if existing.creating {
                    return Err(ServeError::new("busy", format!("window {window_id} of {plugin_id} is already opening")));
                }
                (existing.info.label.clone(), true)
            } else {
                let mine = entries.keys().filter(|(owner, _)| owner == &plugin_id).count();
                if mine >= MAX_PER_PLUGIN {
                    return Err(ServeError::new("limit", format!("plugin {plugin_id} already has {MAX_PER_PLUGIN} open windows")));
                }
                if entries.len() >= MAX_TOTAL {
                    return Err(ServeError::new("limit", format!("cannot open more than {MAX_TOTAL} plugin windows at once")));
                }
                let label = format!("{WINDOW_PREFIX}{}", self.next_id.fetch_add(1, Ordering::SeqCst));
                entries.insert(
                    pair.clone(),
                    Entry {
                        info: PluginWindowInfo {
                            plugin_id: plugin_id.clone(),
                            window_id: window_id.clone(),
                            label: label.clone(),
                            kind: kind.clone(),
                            title: title.clone(),
                            width,
                            height,
                            x: spec.x,
                            y: spec.y,
                            visible,
                            focused,
                            always_on_top,
                            resizable,
                            click_through,
                        },
                        creating: true,
                    },
                );
                (label, false)
            }
        };

        let create_spec = CreateWindow {
            plugin_id: plugin_id.clone(),
            window_id: window_id.clone(),
            label: label.clone(),
            kind: kind.clone(),
            title: title.clone(),
            width,
            height,
            x: spec.x,
            y: spec.y,
            visible,
            always_on_top,
            resizable,
            click_through,
        };

        let applied = if reusing && driver.exists(&label) {
            let patch = WindowPatch {
                title: Some(title.clone()),
                size: Some((width, height)),
                position: spec.x.zip(spec.y),
                always_on_top: Some(always_on_top),
                resizable: Some(resizable),
                click_through: Some(click_through),
            };
            driver.update(&label, &patch).and_then(|()| {
                if visible {
                    driver.show(&label)?;
                    if focused {
                        let _ = driver.focus(&label);
                    }
                    Ok(())
                } else {
                    driver.hide(&label)
                }
            })
        } else {
            driver.create(&create_spec)
        };

        if let Err(error) = applied {
            if !reusing {
                self.lock().remove(&pair);
            }
            return Err(ServeError::new("failed", error));
        }

        let mut entries = self.lock();
        let next_x = spec.x.or_else(|| entries.get(&pair).and_then(|entry| entry.info.x));
        let next_y = spec.y.or_else(|| entries.get(&pair).and_then(|entry| entry.info.y));
        let info = PluginWindowInfo {
            plugin_id,
            window_id,
            label,
            kind,
            title,
            width,
            height,
            x: next_x,
            y: next_y,
            visible,
            focused,
            always_on_top,
            resizable,
            click_through,
        };
        entries.insert(pair, Entry { info: info.clone(), creating: false });
        Ok(info)
    }

    pub(super) fn control(
        &self,
        driver: &dyn WindowDriver,
        req: ControlRequest,
    ) -> Result<(Option<PluginWindowInfo>, Vec<Value>), ServeError> {
        let plugin_id = req.plugin_id.trim().to_owned();
        if plugin_id.is_empty() {
            return Err(ServeError::bad_params("pluginKernel.windowControl", "pluginId must not be empty"));
        }
        let window_id = req.window_id.as_deref().map(str::trim).filter(|id| !id.is_empty()).map(str::to_owned);
        let action = req.action.trim();

        if action == "closeAll" || (action == "close" && window_id.is_none()) {
            let removed: Vec<PluginWindowInfo> = {
                let mut entries = self.lock();
                let keys: Vec<(String, String)> = entries
                    .keys()
                    .filter(|(owner, _)| owner == &plugin_id)
                    .cloned()
                    .collect();
                keys.into_iter().filter_map(|pair| entries.remove(&pair).map(|entry| entry.info)).collect()
            };
            let mut events = Vec::with_capacity(removed.len());
            for info in removed {
                driver.close(&info.label);
                events.push(closed_payload(&info.plugin_id, &info.window_id, &info.label));
            }
            return Ok((None, events));
        }

        let Some(window_id) = window_id else {
            return Err(ServeError::bad_params("pluginKernel.windowControl", "windowId is required"));
        };
        let pair = (plugin_id.clone(), window_id.clone());

        if action == "close" {
            let removed = self.lock().remove(&pair).map(|entry| entry.info);
            let mut events = Vec::new();
            if let Some(info) = removed {
                driver.close(&info.label);
                events.push(closed_payload(&info.plugin_id, &info.window_id, &info.label));
            }
            return Ok((None, events));
        }

        let current = self
            .lock()
            .get(&pair)
            .filter(|entry| !entry.creating)
            .map(|entry| entry.info.clone())
            .ok_or_else(|| ServeError::new("not-found", format!("window {window_id} of {plugin_id} is not open")))?;

        match action {
            "show" => {
                driver.show(&current.label).map_err(|error| ServeError::new("failed", error))?;
                let info = self.mutate(&pair, |info| info.visible = true)?;
                Ok((Some(info), Vec::new()))
            }
            "hide" => {
                driver.hide(&current.label).map_err(|error| ServeError::new("failed", error))?;
                let info = self.mutate(&pair, |info| {
                    info.visible = false;
                    info.focused = false;
                })?;
                Ok((Some(info), Vec::new()))
            }
            "focus" => {
                driver.show(&current.label).map_err(|error| ServeError::new("failed", error))?;
                driver.focus(&current.label).map_err(|error| ServeError::new("failed", error))?;
                let info = self.mutate(&pair, |info| {
                    info.visible = true;
                    info.focused = true;
                })?;
                Ok((Some(info), Vec::new()))
            }
            "update" => {
                let next_w = match req.width {
                    Some(w) => Some(check_side("pluginKernel.windowControl", "width", w)?),
                    None => None,
                };
                let next_h = match req.height {
                    Some(h) => Some(check_side("pluginKernel.windowControl", "height", h)?),
                    None => None,
                };
                check_coord("pluginKernel.windowControl", "x", req.x)?;
                check_coord("pluginKernel.windowControl", "y", req.y)?;
                let size = if next_w.is_some() || next_h.is_some() {
                    Some((next_w.unwrap_or(current.width), next_h.unwrap_or(current.height)))
                } else {
                    None
                };
                let position = if req.x.is_some() || req.y.is_some() {
                    Some((req.x.or(current.x).unwrap_or(0.0), req.y.or(current.y).unwrap_or(0.0)))
                } else {
                    None
                };
                let patch = WindowPatch {
                    title: req.title.clone(),
                    size,
                    position,
                    always_on_top: req.always_on_top,
                    resizable: req.resizable,
                    click_through: req.click_through,
                };
                driver.update(&current.label, &patch).map_err(|error| ServeError::new("failed", error))?;
                let info = self.mutate(&pair, |info| {
                    if let Some(title) = req.title {
                        info.title = title;
                    }
                    if let Some((w, h)) = size {
                        info.width = w;
                        info.height = h;
                    }
                    if let Some((px, py)) = position {
                        info.x = Some(px);
                        info.y = Some(py);
                    }
                    if let Some(on_top) = req.always_on_top {
                        info.always_on_top = on_top;
                    }
                    if let Some(can_resize) = req.resizable {
                        info.resizable = can_resize;
                    }
                    if let Some(through) = req.click_through {
                        info.click_through = through;
                    }
                })?;
                Ok((Some(info), Vec::new()))
            }
            other => Err(ServeError::bad_params("pluginKernel.windowControl", format!("unknown window action {other}"))),
        }
    }

    fn mutate(&self, pair: &(String, String), edit: impl FnOnce(&mut PluginWindowInfo)) -> Result<PluginWindowInfo, ServeError> {
        let mut entries = self.lock();
        let entry = entries
            .get_mut(pair)
            .ok_or_else(|| ServeError::new("not-found", format!("window {} of {} is not open", pair.1, pair.0)))?;
        edit(&mut entry.info);
        Ok(entry.info.clone())
    }

    pub(super) fn list(&self, plugin_id: Option<&str>) -> Vec<PluginWindowInfo> {
        let filter = plugin_id.map(str::trim).filter(|id| !id.is_empty());
        self.lock()
            .values()
            .filter(|entry| !entry.creating && filter.is_none_or(|id| entry.info.plugin_id == id))
            .map(|entry| entry.info.clone())
            .collect()
    }

    pub(super) fn drain_labels(&self) -> Vec<String> {
        let mut entries = self.lock();
        std::mem::take(&mut *entries).into_values().map(|entry| entry.info.label).collect()
    }

    pub(super) fn on_focused(&self, plugin_id: &str, window_id: &str, label: &str, focused: bool) {
        let mut entries = self.lock();
        if let Some(entry) = entries.get_mut(&(plugin_id.to_owned(), window_id.to_owned())) {
            if entry.info.label == label {
                entry.info.focused = focused;
            }
        }
    }

    pub(super) fn on_moved(&self, plugin_id: &str, window_id: &str, label: &str, x: f64, y: f64) {
        let mut entries = self.lock();
        if let Some(entry) = entries.get_mut(&(plugin_id.to_owned(), window_id.to_owned())) {
            if entry.info.label == label {
                entry.info.x = Some(x);
                entry.info.y = Some(y);
            }
        }
    }

    pub(super) fn on_resized(&self, plugin_id: &str, window_id: &str, label: &str, width: f64, height: f64) {
        let mut entries = self.lock();
        if let Some(entry) = entries.get_mut(&(plugin_id.to_owned(), window_id.to_owned())) {
            if entry.info.label == label {
                entry.info.width = width;
                entry.info.height = height;
            }
        }
    }

    pub(super) fn on_destroyed(&self, plugin_id: &str, window_id: &str, label: &str) -> bool {
        let mut entries = self.lock();
        let pair = (plugin_id.to_owned(), window_id.to_owned());
        if entries.get(&pair).is_some_and(|entry| entry.info.label == label) {
            entries.remove(&pair);
            return true;
        }
        false
    }
}

fn check_side(method: &str, name: &str, value: f64) -> Result<f64, ServeError> {
    if !value.is_finite() || value <= 0.0 {
        return Err(ServeError::bad_params(method, format!("{name} must be a positive number")));
    }
    Ok(value.clamp(MIN_SIDE, MAX_SIDE))
}

fn check_coord(method: &str, name: &str, value: Option<f64>) -> Result<(), ServeError> {
    if value.is_some_and(|coord| !coord.is_finite()) {
        return Err(ServeError::bad_params(method, format!("{name} must be a finite number")));
    }
    Ok(())
}

fn closed_payload(plugin_id: &str, window_id: &str, label: &str) -> Value {
    json!({
        "pluginId": plugin_id,
        "windowId": window_id,
        "label": label,
        "type": "closed",
    })
}

pub(crate) fn encode_query_component(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for &byte in value.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(char::from(byte));
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

pub(crate) fn window_url(plugin_id: &str, window_id: &str, kind: &str, title: &str) -> String {
    format!(
        "index.html?window=plugin-window&plugin={}&windowId={}&kind={}&title={}",
        encode_query_component(plugin_id),
        encode_query_component(window_id),
        encode_query_component(kind),
        encode_query_component(title),
    )
}

static MANAGER: OnceLock<WindowManager> = OnceLock::new();
static DRIVER: OnceLock<Arc<dyn WindowDriver>> = OnceLock::new();
static EVENT_TX: OnceLock<mpsc::Sender<Value>> = OnceLock::new();

fn manager() -> &'static WindowManager {
    MANAGER.get_or_init(WindowManager::new)
}

fn driver() -> Result<&'static dyn WindowDriver, ServeError> {
    DRIVER
        .get()
        .map(Arc::as_ref)
        .ok_or_else(|| ServeError::new("failed", "the plugin window backend is not initialized"))
}

fn dispatch_window_event(payload: Value) {
    let sender = EVENT_TX.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<Value>();
        let _ = thread::Builder::new().name("plugin-window-events".into()).spawn(move || {
            for event in rx {
                super::notify_window_event(event);
            }
        });
        tx
    });
    let _ = sender.send(payload);
}

struct TauriWindowDriver {
    app: AppHandle,
}

impl TauriWindowDriver {
    fn get(&self, label: &str) -> Result<WebviewWindow, String> {
        self.app
            .get_webview_window(label)
            .ok_or_else(|| format!("plugin window {label} is not open"))
    }
}

impl WindowDriver for TauriWindowDriver {
    fn exists(&self, label: &str) -> bool {
        self.app.get_webview_window(label).is_some()
    }

    fn create(&self, spec: &CreateWindow) -> Result<(), String> {
        let url = window_url(&spec.plugin_id, &spec.window_id, &spec.kind, &spec.title);
        let mut builder = WebviewWindowBuilder::new(&self.app, &spec.label, WebviewUrl::App(url.into()))
            .title(&spec.title)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(spec.always_on_top)
            .resizable(spec.resizable)
            .visible(spec.visible)
            .skip_taskbar(spec.kind == "widget")
            .focused(spec.kind == "overlay" && spec.visible)
            .inner_size(spec.width, spec.height);
        if let (Some(x), Some(y)) = (spec.x, spec.y) {
            builder = builder.position(x, y);
        }
        let window = builder.build().map_err(|error| error.to_string())?;
        let _ = window.set_ignore_cursor_events(spec.click_through);
        attach_events(&window, spec.plugin_id.clone(), spec.window_id.clone(), spec.label.clone());
        Ok(())
    }

    fn update(&self, label: &str, patch: &WindowPatch) -> Result<(), String> {
        let window = self.get(label)?;
        if let Some(title) = &patch.title {
            window.set_title(title).map_err(|error| error.to_string())?;
        }
        if let Some((width, height)) = patch.size {
            window
                .set_size(Size::Logical(LogicalSize::new(width, height)))
                .map_err(|error| error.to_string())?;
        }
        if let Some((x, y)) = patch.position {
            window
                .set_position(Position::Logical(LogicalPosition::new(x, y)))
                .map_err(|error| error.to_string())?;
        }
        if let Some(always_on_top) = patch.always_on_top {
            window.set_always_on_top(always_on_top).map_err(|error| error.to_string())?;
        }
        if let Some(resizable) = patch.resizable {
            window.set_resizable(resizable).map_err(|error| error.to_string())?;
        }
        if let Some(click_through) = patch.click_through {
            window.set_ignore_cursor_events(click_through).map_err(|error| error.to_string())?;
        }
        Ok(())
    }

    fn show(&self, label: &str) -> Result<(), String> {
        self.get(label)?.show().map_err(|error| error.to_string())
    }

    fn hide(&self, label: &str) -> Result<(), String> {
        self.get(label)?.hide().map_err(|error| error.to_string())
    }

    fn focus(&self, label: &str) -> Result<(), String> {
        self.get(label)?.set_focus().map_err(|error| error.to_string())
    }

    fn close(&self, label: &str) {
        if let Some(window) = self.app.get_webview_window(label) {
            let _ = window.destroy();
        }
    }
}

fn attach_events(window: &WebviewWindow, plugin_id: String, window_id: String, label: String) {
    let tracked = window.clone();
    window.on_window_event(move |event| {
        let scale = || {
            tracked
                .scale_factor()
                .ok()
                .filter(|factor| factor.is_finite() && *factor > 0.0)
                .unwrap_or(1.0)
        };
        let payload = match event {
            WindowEvent::Focused(focused) => {
                manager().on_focused(&plugin_id, &window_id, &label, *focused);
                Some(json!({
                    "pluginId": plugin_id,
                    "windowId": window_id,
                    "label": label,
                    "type": "focused",
                    "focused": *focused,
                }))
            }
            WindowEvent::Moved(position) => {
                let factor = scale();
                let (x, y) = (f64::from(position.x) / factor, f64::from(position.y) / factor);
                manager().on_moved(&plugin_id, &window_id, &label, x, y);
                Some(json!({
                    "pluginId": plugin_id,
                    "windowId": window_id,
                    "label": label,
                    "type": "moved",
                    "x": x,
                    "y": y,
                }))
            }
            WindowEvent::Resized(size) => {
                let factor = scale();
                let (width, height) = (f64::from(size.width) / factor, f64::from(size.height) / factor);
                manager().on_resized(&plugin_id, &window_id, &label, width, height);
                Some(json!({
                    "pluginId": plugin_id,
                    "windowId": window_id,
                    "label": label,
                    "type": "resized",
                    "width": width,
                    "height": height,
                }))
            }
            WindowEvent::Destroyed => manager()
                .on_destroyed(&plugin_id, &window_id, &label)
                .then(|| closed_payload(&plugin_id, &window_id, &label)),
            _ => None,
        };
        if let Some(payload) = payload {
            dispatch_window_event(payload);
        }
    });
}

pub(crate) fn init(app: &AppHandle) {
    let _ = DRIVER.set(Arc::new(TauriWindowDriver { app: app.clone() }));
}

pub(crate) fn close_all(app: &AppHandle) {
    let tracked = manager().drain_labels();
    for label in tracked {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.destroy();
        }
    }
    for (label, window) in app.webview_windows() {
        if label.starts_with(WINDOW_PREFIX) {
            let _ = window.destroy();
        }
    }
}

pub(crate) fn clear() {
    let tracked = manager().drain_labels();
    if let Some(driver) = DRIVER.get() {
        for label in tracked {
            driver.close(&label);
        }
    }
}

#[host_service("pluginKernel.windowOpen")]
pub(crate) fn window_open(spec: PluginWindowOpenSpec) -> Result<PluginWindowInfo, ServeError> {
    manager().open(driver()?, spec)
}

#[host_service("pluginKernel.windowControl")]
#[expect(clippy::too_many_arguments, reason = "IPC parameters for pluginKernel.windowControl")]
pub(crate) fn window_control(
    plugin_id: String,
    window_id: Option<String>,
    action: String,
    title: Option<String>,
    width: Option<f64>,
    height: Option<f64>,
    x: Option<f64>,
    y: Option<f64>,
    always_on_top: Option<bool>,
    resizable: Option<bool>,
    click_through: Option<bool>,
) -> Result<Option<PluginWindowInfo>, ServeError> {
    let (info, events) = manager().control(
        driver()?,
        ControlRequest {
            plugin_id,
            window_id,
            action,
            title,
            width,
            height,
            x,
            y,
            always_on_top,
            resizable,
            click_through,
        },
    )?;
    for event in events {
        dispatch_window_event(event);
    }
    Ok(info)
}

#[host_service("pluginKernel.windowList")]
pub(crate) fn window_list(plugin_id: Option<String>) -> PluginWindowList {
    PluginWindowList {
        windows: manager().list(plugin_id.as_deref()),
    }
}

#[cfg(test)]
#[path = "plugin_windows_tests.rs"]
mod tests;
