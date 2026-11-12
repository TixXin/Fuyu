use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    cell::RefCell,
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    rc::Rc,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{AppHandle, Manager};

use super::{
    host, lifecycle, lock,
    view_specs::{ViewTemplate, DEFAULT_WEBVIEW_HEIGHT},
};
use crate::{
    island,
    win32::webview_page::{self, Page, PageHost, PageOptions, Resource},
};

const HOST_SUFFIX: &str = ".plugin.focusd.invalid";
const MAX_MESSAGE_BYTES: usize = 256 * 1024;
const MAX_STATE_BYTES: usize = 64 * 1024;
const MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;
pub(super) const CSP: &str = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; \
img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; \
worker-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";

type Key = (String, String);

pub(super) fn origin(plugin_id: &str) -> String {
    format!("https://{plugin_id}{HOST_SUFFIX}")
}

pub(super) fn resource_path(root: &Path, origin: &str, url: &str) -> Option<PathBuf> {
    let path = url.strip_prefix(origin)?.strip_prefix('/')?;
    let path = path.split(['?', '#']).next().unwrap_or_default();
    let decoded = percent_decode(path)?;
    if decoded.is_empty() || decoded.contains(['\\', ':', '\0']) {
        return None;
    }
    let mut file = root.to_path_buf();
    for part in decoded.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return None;
        }
        file.push(part);
    }
    let real_root = fs::canonicalize(root).ok()?;
    let real_file = fs::canonicalize(&file).ok()?;
    (real_file.starts_with(&real_root) && real_file.is_file()).then_some(real_file)
}

fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = text.get(index + 1..index + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

pub(super) fn content_type(path: &Path) -> &'static str {
    let extension = path.extension().and_then(|extension| extension.to_str()).unwrap_or_default().to_ascii_lowercase();
    match extension.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "txt" | "md" => "text/plain; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        _ => "application/octet-stream",
    }
}

pub(super) fn may_navigate(origin: &str, url: &str, frame: bool) -> bool {
    let own = url.strip_prefix(origin).is_some_and(|rest| rest.starts_with('/'));
    own || (frame && (url == "about:blank" || url == "about:srcdoc"))
}

#[derive(Debug, PartialEq)]
pub(super) enum PageMessage {
    Message(Value),
    State(Value),
}

pub(super) fn parse_page_message(json: &str) -> Result<PageMessage, String> {
    let value: Value = serde_json::from_str(json).map_err(|_| "The page sent something that is not JSON.".to_string())?;
    let size = |value: &Value| serde_json::to_vec(value).map(|bytes| bytes.len()).unwrap_or(usize::MAX);
    match value.get("type").and_then(Value::as_str) {
        Some("message") => {
            let message = value.get("message").cloned().unwrap_or(Value::Null);
            if size(&message) > MAX_MESSAGE_BYTES {
                return Err("The page's message is larger than 256 KB.".into());
            }
            Ok(PageMessage::Message(message))
        }
        Some("state") => {
            let state = value.get("state").cloned().unwrap_or(Value::Null);
            if size(&state) > MAX_STATE_BYTES {
                return Err("The page's state is larger than 64 KB.".into());
            }
            Ok(PageMessage::State(state))
        }
        _ => Err("The page sent a message of an unknown type.".into()),
    }
}

fn theme_css(ink: Option<&str>) -> String {
    const FONT: &str = r#"--fuyu-radius:8px;--fuyu-font:"Segoe UI Variable Text","Segoe UI","Microsoft YaHei UI",sans-serif"#;
    const ACCENTS: &str = "--fuyu-accent:#74d6ff;--fuyu-success:#2f8c61;--fuyu-warning:#ffd166;--fuyu-danger:#c75065";
    let parsed = ink.and_then(|ink| {
        let parts: Vec<u8> = ink.split(',').filter_map(|part| part.trim().parse().ok()).collect();
        (parts.len() == 3 && ink.split(',').count() == 3).then(|| (parts[0], parts[1], parts[2]))
    });
    let (scheme, variables) = match parsed {
        Some((r, g, b)) => {
            let light_island = u32::from(r) + u32::from(g) + u32::from(b) < 384;
            let (scheme, accent) = if light_island { ("light", "--fuyu-accent:#0a84c6;--fuyu-success:#2f8c61;--fuyu-warning:#b7791f;--fuyu-danger:#c75065") } else { ("dark", ACCENTS) };
            (
                scheme,
                format!("--fuyu-text:rgb({r},{g},{b});--fuyu-text-muted:rgba({r},{g},{b},.68);--fuyu-surface:rgba({r},{g},{b},.06);--fuyu-border:rgba({r},{g},{b},.12);{accent};{FONT}"),
            )
        }
        None => ("dark", format!("--fuyu-text:#f8f6f0;--fuyu-text-muted:rgba(248,246,240,.72);--fuyu-surface:rgba(255,255,255,.08);--fuyu-border:rgba(255,255,255,.12);{ACCENTS};{FONT}")),
    };
    let legacy = variables.replace("--fuyu-", "--focusd-");
    format!(":root{{color-scheme:{scheme};{variables};{legacy}}}")
}

pub(super) fn init_script(state: &Value, locale: &str, ink: Option<&str>) -> String {
    let locale = if locale == "zh-CN" { "zh-CN" } else { "en" };
    INIT_SCRIPT
        .replace("__THEME__", &theme_css(ink))
        .replace("__STATE__", &state.to_string())
        .replace("__LOCALE__", locale)
}

const INIT_SCRIPT: &str = r#"(() => {
  const theme = new CSSStyleSheet();
  theme.replaceSync('__THEME__');
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, theme];
  for (const name of ["RTCPeerConnection", "webkitRTCPeerConnection", "RTCDataChannel", "RTCSessionDescription", "RTCIceCandidate"]) {
    try { Object.defineProperty(window, name, { value: undefined, configurable: false, writable: false }); } catch {}
  }
  if (window.top !== window) return;
  const channel = window.chrome && window.chrome.webview;
  if (!channel) return;
  let state = __STATE__;
  let taken = false;
  const listeners = new Set();
  channel.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "message") return;
    for (const listener of listeners) {
      try { listener(data.message); } catch (error) { console.error(error); }
    }
  });
  const api = Object.freeze({
    locale: "__LOCALE__",
    postMessage(message) { channel.postMessage({ type: "message", message }); },
    getState() { return state; },
    setState(next) { state = next; channel.postMessage({ type: "state", state: next }); return next; },
    onMessage(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  });
  for (const name of ["acquireFuyuApi", "acquireFocusdApi"]) {
    Object.defineProperty(window, name, {
      value() {
        if (taken) throw new Error(name + "() can be called only once.");
        taken = true;
        return api;
      },
    });
  }
})();"#;

fn states() -> &'static Mutex<HashMap<Key, Value>> {
    static STATES: std::sync::OnceLock<Mutex<HashMap<Key, Value>>> = std::sync::OnceLock::new();
    STATES.get_or_init(Mutex::default)
}

pub(super) fn forget_plugin(plugin_id: &str) {
    lock(states()).retain(|(plugin, _), _| plugin != plugin_id);
}

fn open() -> &'static Mutex<HashSet<Key>> {
    static OPEN: std::sync::OnceLock<Mutex<HashSet<Key>>> = std::sync::OnceLock::new();
    OPEN.get_or_init(Mutex::default)
}

struct PageSpec {
    root: PathBuf,
    file: String,
    dev: bool,
    locale: String,
    ink: Option<String>,
}

fn page_spec(plugin_id: &str, view_id: &str) -> Result<PageSpec, String> {
    let host = host()?;
    let installed = lock(&host.installed);
    let plugin = installed.iter().find(|plugin| plugin.folder == plugin_id).ok_or("Plugin not found.")?;
    let manifest = plugin.manifest.as_ref().map_err(|_| "The plugin's manifest is not valid.".to_string())?;
    let enabled = plugin.dev || lock(&host.state).plugins.get(plugin_id).is_some_and(|grant| grant.enabled);
    if !enabled || plugin.builtin {
        return Err("The plugin is not switched on.".into());
    }
    let view = manifest
        .contributes
        .views
        .iter()
        .find(|view| view.id == view_id && view.template == ViewTemplate::Webview)
        .ok_or("Unknown plugin page.")?;
    let entry = view.entry.as_deref().ok_or("The page has no entry.")?;
    let (folder, file) = entry.rsplit_once('/').unwrap_or(("", entry));
    let root = if folder.is_empty() { plugin.dir.clone() } else { plugin.dir.join(folder) };
    Ok(PageSpec { root, file: file.to_string(), dev: plugin.dev, locale: String::new(), ink: None })
}

struct PluginPage {
    plugin_id: String,
    view_id: String,
    origin: String,
    root: PathBuf,
}

impl PageHost for PluginPage {
    fn resource(&self, url: &str) -> Option<Resource> {
        if !may_navigate(&self.origin, url, false) {
            return None;
        }
        let file = resource_path(&self.root, &self.origin, url)
            .filter(|file| fs::metadata(file).is_ok_and(|meta| meta.len() <= MAX_FILE_BYTES));
        let body = file.as_ref().and_then(|file| fs::read(file).ok());
        let (status, body, kind) = match (file, body) {
            (Some(file), Some(body)) => (200, body, content_type(&file)),
            _ => (404, Vec::new(), "text/plain; charset=utf-8"),
        };
        Some(Resource {
            status,
            headers: vec![
                format!("Content-Type: {kind}"),
                format!("Content-Security-Policy: {CSP}"),
                "X-Content-Type-Options: nosniff".into(),
                "Cache-Control: no-store".into(),
                "Referrer-Policy: no-referrer".into(),
                "X-DNS-Prefetch-Control: off".into(),
            ],
            body,
        })
    }

    fn may_navigate(&self, url: &str, frame: bool) -> bool {
        may_navigate(&self.origin, url, frame)
    }

    fn message(&self, source: &str, json: String) {
        if !may_navigate(&self.origin, source, false) {
            return;
        }
        let key = (self.plugin_id.clone(), self.view_id.clone());
        match parse_page_message(&json) {
            Ok(PageMessage::State(state)) => {
                lock(states()).insert(key, state);
            }
            Ok(PageMessage::Message(message)) => {
                let params = json!({ "viewId": self.view_id, "message": message });
                if let Err(error) = lifecycle::deliver(&self.plugin_id, format!("onView:{}", self.view_id), "webview.message", params) {
                    eprintln!("plugin page message for {} not delivered: {error}", self.plugin_id);
                }
            }
            Err(error) => eprintln!("plugin page of {}: {error}", self.plugin_id),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Rect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

struct Slot {
    page: Option<Page>,
    rect: Rect,
    generation: u64,
}

thread_local! {
    static PAGES: RefCell<HashMap<Key, Slot>> = RefCell::new(HashMap::new());
}

static GENERATION: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct WebviewBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn to_rect(bounds: WebviewBounds, scale: f64) -> Result<Rect, String> {
    let pixel = |value: f64| {
        let value = (value * scale).round();
        (value.is_finite() && (-10_000.0..=10_000.0).contains(&value))
            .then_some(value as i32)
            .ok_or_else(|| "The page bounds are not valid.".to_string())
    };
    Ok(Rect { x: pixel(bounds.x)?, y: pixel(bounds.y)?, width: pixel(bounds.width)?.max(0), height: pixel(bounds.height)?.max(0) })
}

#[tauri::command]
pub fn show_plugin_webview(app: AppHandle, id: String, view_id: String, bounds: WebviewBounds, locale: String, ink: Option<String>) -> Result<(), String> {
    let spec = PageSpec { locale, ink, ..page_spec(&id, &view_id)? };
    let window = app.get_webview_window(island::WINDOW_LABEL).ok_or("The island window is not open.")?;
    let scale = window.scale_factor().map_err(|error| format!("Could not read the window scale: {error}"))?;
    let rect = to_rect(bounds, scale)?;
    let key = (id, view_id);
    lock(open()).insert(key.clone());
    app.run_on_main_thread(move || place_or_create(window, key, spec, rect))
        .map_err(|error| format!("Could not show the plugin page: {error}"))
}

#[tauri::command]
pub fn hide_plugin_webview(app: AppHandle, id: String, view_id: String) -> Result<(), String> {
    let key = (id, view_id);
    lock(open()).remove(&key);
    app.run_on_main_thread(move || {
        let closed = PAGES.with(|pages| pages.borrow_mut().remove(&key));
        drop(closed);
    })
    .map_err(|error| format!("Could not close the plugin page: {error}"))
}

fn place_or_create(window: tauri::WebviewWindow, key: Key, spec: PageSpec, rect: Rect) {
    let generation = PAGES.with(|pages| {
        let mut pages = pages.borrow_mut();
        if let Some(slot) = pages.get_mut(&key) {
            slot.rect = rect;
            if let Some(page) = &slot.page {
                page.place(rect.x, rect.y, rect.width, rect.height);
            }
            return None;
        }
        let generation = GENERATION.fetch_add(1, Ordering::Relaxed);
        pages.insert(key.clone(), Slot { page: None, rect, generation });
        Some(generation)
    });
    let Some(generation) = generation else { return };
    let created = window.with_webview(move |platform| {
        if let Err(error) = start_page(&platform.environment(), &platform.controller(), key.clone(), spec, generation) {
            eprintln!("plugin page {}/{} failed: {error}", key.0, key.1);
            PAGES.with(|pages| pages.borrow_mut().remove(&key));
        }
    });
    if let Err(error) = created {
        eprintln!("plugin page failed: {error}");
    }
}

fn start_page(
    env: &webview_page::ICoreWebView2Environment,
    island: &webview_page::ICoreWebView2Controller,
    key: Key,
    spec: PageSpec,
    generation: u64,
) -> Result<(), String> {
    let parent = webview_page::parent_window(island)?;
    let origin = origin(&key.0);
    let state = lock(states()).get(&key).cloned().unwrap_or(Value::Null);
    let options = PageOptions {
        start_url: format!("{origin}/{}", spec.file),
        init_script: init_script(&state, &spec.locale, spec.ink.as_deref()),
        dev_tools: spec.dev,
    };
    let host = Rc::new(PluginPage { plugin_id: key.0.clone(), view_id: key.1.clone(), origin, root: spec.root });
    webview_page::create(env, parent, options, host, move |result| {
        let page = match result {
            Ok(page) => page,
            Err(error) => {
                eprintln!("plugin page {}/{} failed: {error}", key.0, key.1);
                PAGES.with(|pages| pages.borrow_mut().remove(&key));
                return;
            }
        };
        let unwanted = PAGES.with(|pages| {
            let mut pages = pages.borrow_mut();
            match pages.get_mut(&key).filter(|slot| slot.generation == generation) {
                Some(slot) => {
                    page.place(slot.rect.x, slot.rect.y, slot.rect.width, slot.rect.height);
                    slot.page = Some(page);
                    None
                }
                None => Some(page),
            }
        });
        drop(unwanted);
    })
}

pub(super) fn post_from_plugin(app: &AppHandle, plugin_id: &str, params: &Value) -> Result<Value, (u16, String)> {
    let view_id = params.get("viewId").and_then(Value::as_str).ok_or((400, "viewId is required.".to_string()))?;
    if page_spec(plugin_id, view_id).is_err() {
        return Err((400, format!("The plugin has no webview page \"{view_id}\".")));
    }
    let message = params.get("message").cloned().unwrap_or(Value::Null);
    let json = json!({ "type": "message", "message": message }).to_string();
    if json.len() > MAX_MESSAGE_BYTES {
        return Err((400, "The message is larger than 256 KB.".into()));
    }
    let key = (plugin_id.to_string(), view_id.to_string());
    let shown = lock(open()).contains(&key);
    if shown {
        let _ = app.run_on_main_thread(move || {
            PAGES.with(|pages| {
                if let Some(page) = pages.borrow().get(&key).and_then(|slot| slot.page.as_ref()) {
                    let _ = page.post_json(&json);
                }
            });
        });
    }
    Ok(json!({ "shown": shown }))
}

pub(super) fn page_height(height: Option<u32>) -> u32 {
    height.unwrap_or(DEFAULT_WEBVIEW_HEIGHT)
}
