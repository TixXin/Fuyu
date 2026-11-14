mod native;
mod rules;
mod spec;
#[cfg(test)]
mod tests;

pub(super) use rules::WindowRules;

use serde_json::{json, Value};
use std::{
    collections::{HashMap, VecDeque},
    path::PathBuf,
    sync::{mpsc, Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

use super::{host, lock, reveal};
use crate::island;
use spec::{Kind, Layer, Options, Rect, MAX_PER_PLUGIN, MAX_TOTAL, MAX_UPDATES_PER_SECOND};

const MAIN_THREAD_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_MESSAGE_BYTES: usize = 256 * 1024;

type Key = (String, String);
type Fail = (u16, String);

#[derive(Debug, Clone)]
struct Summary {
    kind: Kind,
    entry: String,
    options: Options,
    visible: bool,
    focused: bool,
    bounds: Rect,
    screen: Option<String>,
    updates: VecDeque<Instant>,
}

impl Summary {
    fn to_json(&self, id: &str) -> Value {
        json!({
            "id": id,
            "kind": self.kind.name(),
            "entry": self.entry,
            "visible": self.visible,
            "focused": self.focused,
            "bounds": self.bounds.to_json(),
            "screen": self.screen,
            "layer": self.options.layer.name(),
            "opacity": self.options.opacity,
            "clickThrough": self.options.click_through,
            "resizable": self.options.resizable,
            "hideOnBlur": self.options.hide_on_blur,
            "title": self.options.title,
        })
    }
}

fn table() -> &'static Mutex<HashMap<Key, Summary>> {
    static TABLE: OnceLock<Mutex<HashMap<Key, Summary>>> = OnceLock::new();
    TABLE.get_or_init(Mutex::default)
}

pub(super) fn has_any(plugin_id: &str) -> bool {
    lock(table()).keys().any(|(plugin, _)| plugin == plugin_id)
}

pub(super) struct Caller<'a> {
    pub app: &'a AppHandle,
    pub plugin_id: &'a str,
    pub display_name: &'a str,
}

struct PluginFiles {
    root: PathBuf,
    dev: bool,
}

fn plugin_files(plugin_id: &str) -> Result<PluginFiles, Fail> {
    let host = host().map_err(|error| (500, error))?;
    let installed = lock(&host.installed);
    let plugin = installed.iter().find(|plugin| plugin.folder == plugin_id).ok_or((404, "Plugin not found.".to_string()))?;
    Ok(PluginFiles { root: plugin.dir.clone(), dev: plugin.dev })
}

fn on_main<T: Send + 'static>(app: &AppHandle, work: impl FnOnce() -> T + Send + 'static) -> Result<T, Fail> {
    let (sender, receiver) = mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = sender.send(work());
    })
    .map_err(|error| (500, format!("Could not reach the window thread: {error}")))?;
    receiver.recv_timeout(MAIN_THREAD_TIMEOUT).map_err(|_| (500, "The window thread did not answer in time.".to_string()))
}

fn require_recent_use(plugin_id: &str, what: &str) -> Result<(), Fail> {
    if reveal::recently_used(plugin_id) {
        Ok(())
    } else {
        Err((
            403,
            format!(
                "A panel can {what} only within {} s of the user using the plugin (its shortcut, a command, a message button or one of its windows).",
                reveal::OPEN_WINDOW.as_secs()
            ),
        ))
    }
}

fn summary(key: &Key) -> Result<Summary, Fail> {
    lock(table()).get(key).cloned().ok_or_else(|| (404, format!("The plugin has no window \"{}\".", key.1)))
}

pub(super) fn answer(caller: Caller<'_>, method: &str, params: &Value) -> Result<Value, Fail> {
    let plugin_id = caller.plugin_id.to_string();
    match method {
        "screens.list" => {
            let screens = on_main(caller.app, native::screen_areas)?;
            Ok(json!({ "screens": screens.iter().map(spec::ScreenArea::to_json).collect::<Vec<_>>() }))
        }
        "window.list" => {
            let table = lock(table());
            let windows: Vec<Value> = table.iter().filter(|((plugin, _), _)| *plugin == plugin_id).map(|((_, id), summary)| summary.to_json(id)).collect();
            Ok(json!({ "windows": windows }))
        }
        "window.create" => create(caller, params),
        "window.update" => update(caller.app, plugin_id, params),
        "window.show" | "window.focus" => {
            let key = (plugin_id.clone(), spec::parse_id(params)?);
            let window = summary(&key)?;
            let focus = method == "window.focus";
            if focus && window.kind == Kind::Widget {
                return Err((400, "Widgets never take the keyboard focus.".into()));
            }
            if window.kind == Kind::Panel {
                require_recent_use(&plugin_id, if focus { "take the focus" } else { "show" })?;
            }
            if rules::current(&plugin_id).hidden {
                return Err((403, "The user hid this plugin's windows in Settings > Plugins.".into()));
            }
            let focused = on_main(caller.app, move || native::show(&key, window.kind == Kind::Panel))??;
            Ok(json!({ "visible": true, "focused": focused }))
        }
        "window.hide" => {
            let key = (plugin_id, spec::parse_id(params)?);
            summary(&key)?;
            on_main(caller.app, move || native::hide(&key, None))??;
            Ok(json!({}))
        }
        "window.close" => {
            let key = (plugin_id, spec::parse_id(params)?);
            summary(&key)?;
            on_main(caller.app, move || native::close(&key, None))?;
            Ok(json!({}))
        }
        "window.postMessage" => {
            let key = (plugin_id, spec::parse_id(params)?);
            summary(&key)?;
            let message = params.get("message").cloned().unwrap_or(Value::Null);
            let json = json!({ "type": "message", "message": message }).to_string();
            if json.len() > MAX_MESSAGE_BYTES {
                return Err((400, "The message is larger than 256 KB.".into()));
            }
            let delivered = on_main(caller.app, move || native::post(&key, &json))?;
            Ok(json!({ "delivered": delivered }))
        }
        _ => Err((404, format!("Unknown method \"{method}\"."))),
    }
}

fn create(caller: Caller<'_>, params: &Value) -> Result<Value, Fail> {
    let request = spec::parse_create(params)?;
    let plugin_id = caller.plugin_id.to_string();
    let rules = rules::current(&plugin_id);
    if rules.hidden {
        return Err((403, "The user hid this plugin's windows in Settings > Plugins.".into()));
    }
    {
        let table = lock(table());
        if table.contains_key(&(plugin_id.clone(), request.id.clone())) {
            return Err((409, format!("The plugin already has a window \"{}\"; use window.update or close it first.", request.id)));
        }
        if table.keys().filter(|(plugin, _)| *plugin == plugin_id).count() >= MAX_PER_PLUGIN {
            return Err((429, format!("A plugin can have at most {MAX_PER_PLUGIN} windows at once.")));
        }
        if table.len() >= MAX_TOTAL {
            return Err((429, format!("All plugins together can have at most {MAX_TOTAL} windows at once.")));
        }
    }
    if request.kind == Kind::Panel && request.visible {
        require_recent_use(&plugin_id, "show")?;
    }
    let files = plugin_files(&plugin_id)?;
    if super::webviews::resource_path(&files.root, &super::webviews::origin(&plugin_id), &format!("{}/{}", super::webviews::origin(&plugin_id), request.entry)).is_none() {
        return Err((400, format!("\"{}\" is not a file in the plugin folder.", request.entry)));
    }
    let island = caller.app.get_webview_window(island::WINDOW_LABEL).ok_or((500, "The island window is not open.".to_string()))?;
    let context = native::CreateContext {
        plugin_id: plugin_id.clone(),
        display_name: caller.display_name.to_string(),
        root: files.root,
        dev: files.dev,
        rules,
    };
    let (sender, receiver) = mpsc::channel();
    island
        .with_webview(move |platform| {
            let _ = sender.send(native::create(&platform.environment(), context, request));
        })
        .map_err(|error| (500, format!("Could not reach the window thread: {error}")))?;
    let created = receiver.recv_timeout(MAIN_THREAD_TIMEOUT).map_err(|_| (500, "The window thread did not answer in time.".to_string()))??;
    Ok(created)
}

fn update(app: &AppHandle, plugin_id: String, params: &Value) -> Result<Value, Fail> {
    let request = spec::parse_update(params)?;
    let key = (plugin_id.clone(), request.id.clone());
    let current = summary(&key)?;
    {
        let mut table = lock(table());
        if let Some(entry) = table.get_mut(&key) {
            let now = Instant::now();
            entry.updates.retain(|at| now.duration_since(*at) < Duration::from_secs(1));
            if entry.updates.len() >= MAX_UPDATES_PER_SECOND {
                return Err((429, format!("At most {MAX_UPDATES_PER_SECOND} window.update calls per window per second.")));
            }
            entry.updates.push_back(now);
        }
    }
    let mut options = current.options.clone();
    spec::apply_options(&mut options, current.kind, &Value::Object(request.fields.clone()))?;
    let rules = rules::current(&plugin_id);
    let result = on_main(app, move || native::update(&key, options, request.placement, rules))??;
    Ok(result)
}

fn record(key: &Key, summary: Summary) {
    lock(table()).insert(key.clone(), summary);
}

fn change(key: &Key, edit: impl FnOnce(&mut Summary)) {
    if let Some(summary) = lock(table()).get_mut(key) {
        edit(summary);
    }
}

fn forget(key: &Key) {
    lock(table()).remove(key);
}

pub(super) fn tell(plugin_id: &str, method: &str, params: Value) {
    let Ok(host) = host() else { return };
    let supervisors = lock(&host.supervisors);
    if let Some(supervisor) = supervisors.get(plugin_id).filter(|supervisor| supervisor.is_ready()) {
        let _ = supervisor.notify(method, params);
    }
}

pub(super) fn close_plugin(app: &AppHandle, plugin_id: &str) {
    if !has_any(plugin_id) {
        return;
    }
    let plugin_id = plugin_id.to_string();
    let _ = app.run_on_main_thread(move || native::close_plugin(&plugin_id, None));
}

pub(super) fn apply_rules(app: &AppHandle, plugin_id: &str) {
    if !has_any(plugin_id) {
        return;
    }
    let plugin_id = plugin_id.to_string();
    let rules = rules::current(&plugin_id);
    let _ = app.run_on_main_thread(move || native::apply_rules(&plugin_id, rules));
}

fn layer_after_rules(layer: Layer, rules: WindowRules) -> Layer {
    if rules.no_topmost && layer == Layer::Topmost {
        Layer::Normal
    } else {
        layer
    }
}
