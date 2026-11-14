use serde_json::{json, Value};
use std::{
    cell::{Cell, RefCell},
    collections::{BTreeSet, HashMap},
    path::PathBuf,
    rc::Rc,
    time::{Duration, Instant},
};

use super::{
    change, forget, layer_after_rules, record,
    spec::{self, CreateRequest, Kind, Layer, Options, Placement, Rect, ScreenArea},
    tell, Fail, Key, Summary, WindowRules,
};
use crate::{
    plugin_host::{host, reveal, webviews},
    win32::{
        plugin_window::{self, Bounds, Caption, Look, PluginWindow, WindowEvents},
        session_notifications,
        webview_page::{self, ICoreWebView2Environment, Page, PageHost, PageOptions, Resource},
        window::cursor_position,
    },
};

const DISPLAY_CHANGE_GAP: Duration = Duration::from_millis(500);
const RECENT_INPUT_MS: u32 = 1500;

struct Native {
    kind: Kind,
    display_name: String,
    options: RefCell<Options>,
    rules: Cell<WindowRules>,
    window: PluginWindow,
    page: RefCell<Option<Page>>,
    generation: u64,
}

thread_local! {
    static WINDOWS: RefCell<HashMap<Key, Rc<Native>>> = RefCell::new(HashMap::new());
    static NEXT_GENERATION: Cell<u64> = const { Cell::new(1) };
    static LAST_DISPLAY_CHANGE: Cell<Option<Instant>> = const { Cell::new(None) };
}

fn get(key: &Key) -> Option<Rc<Native>> {
    WINDOWS.with(|windows| windows.try_borrow().ok()?.get(key).cloned())
}

fn keys_of(plugin_id: &str) -> Vec<Key> {
    WINDOWS.with(|windows| windows.borrow().keys().filter(|(plugin, _)| plugin == plugin_id).cloned().collect())
}

fn missing(key: &Key) -> Fail {
    (404, format!("The plugin has no window \"{}\".", key.1))
}

fn defer(work: impl FnOnce() + Send + 'static) {
    if let Ok(host) = host() {
        let _ = host.app.run_on_main_thread(work);
    }
}

fn to_bounds(rect: Rect) -> Bounds {
    Bounds { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

fn to_rect(bounds: Bounds) -> Rect {
    Rect { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
}

pub(super) fn screen_areas() -> Vec<ScreenArea> {
    plugin_window::screens()
        .into_iter()
        .map(|screen| ScreenArea {
            id: screen.id,
            work_area: to_rect(screen.work_area),
            bounds: to_rect(screen.bounds),
            scale: screen.scale,
            primary: screen.primary,
        })
        .collect()
}

fn palette() -> ([u8; 3], [u8; 3]) {
    let (_, ink) = webviews::remembered_theme();
    let light = ink
        .and_then(|ink| {
            let parts: Vec<u32> = ink.split(',').filter_map(|part| part.trim().parse().ok()).collect();
            (parts.len() == 3).then(|| parts.iter().sum::<u32>() < 384)
        })
        .unwrap_or(false);
    if light {
        ([246, 246, 248], [28, 28, 32])
    } else {
        ([30, 30, 34], [240, 238, 232])
    }
}

fn look(kind: Kind, display_name: &str, options: &Options, rules: WindowRules) -> Look {
    let title = options.title.clone().unwrap_or_else(|| display_name.to_string());
    let (background, foreground) = palette();
    Look {
        title: spec::system_title(&title),
        layer: match layer_after_rules(options.layer, rules) {
            Layer::Desktop => plugin_window::Layer::Desktop,
            Layer::Normal => plugin_window::Layer::Normal,
            Layer::Topmost => plugin_window::Layer::Topmost,
        },
        alpha: spec::alpha(options.opacity),
        click_through: options.click_through && !rules.no_click_through,
        resizable: options.resizable,
        min_size: options.min_size,
        max_size: options.max_size.unwrap_or((100_000, 100_000)),
        caption: (kind == Kind::Panel).then(|| Caption { text: display_name.to_string(), background, foreground }),
    }
}

pub(super) struct CreateContext {
    pub plugin_id: String,
    pub display_name: String,
    pub root: PathBuf,
    pub dev: bool,
    pub rules: WindowRules,
}

fn summary_json(key: &Key) -> Value {
    super::summary(key).map(|summary| summary.to_json(&key.1)).unwrap_or(Value::Null)
}

pub(super) fn create(env: &ICoreWebView2Environment, context: CreateContext, request: CreateRequest) -> Result<Value, Fail> {
    let screens = screen_areas();
    let wanted_screen = request.placement.screen.as_deref();
    let target = spec::pick_screen(&screens, wanted_screen, request.placement.bounds).ok_or((500, "No screen was found.".to_string()))?;
    let wanted = request.placement.bounds.unwrap_or_else(|| spec::centered(request.kind, target));
    let rect = spec::fit(wanted, request.options.min_size, request.options.max_size, &screens, wanted_screen);
    let key = (context.plugin_id.clone(), request.id.clone());
    let origin = webviews::origin(&context.plugin_id);
    let link = Rc::new(Link { key: key.clone(), kind: request.kind, origin: origin.clone(), root: context.root.clone() });
    let window = PluginWindow::create(look(request.kind, &context.display_name, &request.options, context.rules), to_bounds(rect), link.clone()).map_err(|error| (500, error))?;
    let generation = NEXT_GENERATION.with(|next| {
        let value = next.get();
        next.set(value + 1);
        value
    });
    let native = Rc::new(Native {
        kind: request.kind,
        display_name: context.display_name,
        options: RefCell::new(request.options.clone()),
        rules: Cell::new(context.rules),
        window,
        page: RefCell::new(None),
        generation,
    });
    let hwnd = native.window.hwnd();
    WINDOWS.with(|windows| windows.borrow_mut().insert(key.clone(), native));
    record(
        &key,
        Summary {
            kind: request.kind,
            entry: request.entry.clone(),
            options: request.options,
            visible: false,
            focused: false,
            bounds: rect,
            screen: spec::screen_of(&screens, rect).map(|screen| screen.id.clone()),
            updates: Default::default(),
        },
    );
    let (locale, ink) = webviews::remembered_theme();
    let page_options = PageOptions {
        start_url: format!("{origin}/{}", request.entry),
        init_script: webviews::window_init_script(&locale, ink.as_deref()),
        dev_tools: context.dev,
    };
    let done_key = key.clone();
    if let Err(error) = webview_page::create(env, hwnd, page_options, link, move |result| page_ready(&done_key, generation, result)) {
        close(&key, None);
        return Err((500, error));
    }
    if request.visible {
        show(&key, request.kind == Kind::Panel)?;
    }
    Ok(summary_json(&key))
}

fn page_ready(key: &Key, generation: u64, result: Result<Page, String>) {
    let page = match result {
        Ok(page) => page,
        Err(error) => {
            eprintln!("plugin window {}/{} failed: {error}", key.0, key.1);
            close(key, Some("failed"));
            return;
        }
    };
    let Some(native) = get(key).filter(|native| native.generation == generation) else { return };
    if native.kind == Kind::Panel {
        let (background, _) = palette();
        page.set_background(background[0], background[1], background[2], 255);
    }
    let content = native.window.content();
    page.place(content.x, content.y, content.width, content.height);
    if native.kind == Kind::Panel && native.window.is_foreground() {
        page.focus();
    }
    let unwanted = match native.page.try_borrow_mut() {
        Ok(mut slot) => slot.replace(page),
        Err(_) => Some(page),
    };
    drop(unwanted);
}

pub(super) fn show(key: &Key, activate: bool) -> Result<bool, Fail> {
    let native = get(key).ok_or_else(|| missing(key))?;
    let focused = native.window.show(activate);
    if focused {
        if let Ok(page) = native.page.try_borrow() {
            if let Some(page) = page.as_ref() {
                page.focus();
            }
        }
    }
    change(key, |summary| {
        summary.visible = true;
        summary.focused = focused;
    });
    Ok(focused)
}

pub(super) fn hide(key: &Key, reason: Option<&str>) -> Result<(), Fail> {
    let native = get(key).ok_or_else(|| missing(key))?;
    let was_visible = native.window.is_visible();
    native.window.hide();
    change(key, |summary| {
        summary.visible = false;
        summary.focused = false;
    });
    if let Some(reason) = reason.filter(|_| was_visible) {
        tell(&key.0, "window.hidden", json!({ "id": key.1, "reason": reason }));
    }
    Ok(())
}

pub(super) fn close(key: &Key, reason: Option<&str>) {
    let removed = WINDOWS.with(|windows| windows.borrow_mut().remove(key));
    forget(key);
    let Some(native) = removed else { return };
    let page = native.page.replace(None);
    drop(page);
    drop(native);
    if let Some(reason) = reason {
        tell(&key.0, "window.closed", json!({ "id": key.1, "reason": reason }));
    }
}

pub(super) fn close_plugin(plugin_id: &str, reason: Option<&str>) {
    for key in keys_of(plugin_id) {
        close(&key, reason);
    }
}

pub(super) fn post(key: &Key, json: &str) -> bool {
    let Some(native) = get(key) else { return false };
    let page = native.page.try_borrow();
    page.ok().and_then(|page| page.as_ref().map(|page| page.post_json(json).is_ok())).unwrap_or(false)
}

pub(super) fn update(key: &Key, options: Options, placement: Option<Placement>, rules: WindowRules) -> Result<Value, Fail> {
    let native = get(key).ok_or_else(|| missing(key))?;
    native.window.set_look(&look(native.kind, &native.display_name, &options, rules));
    *native.options.borrow_mut() = options.clone();
    native.rules.set(rules);
    let screens = screen_areas();
    let current = to_rect(native.window.bounds());
    let wanted_screen = placement.as_ref().and_then(|placement| placement.screen.clone());
    let wanted = match &placement {
        Some(Placement { bounds: Some(bounds), .. }) => *bounds,
        Some(Placement { bounds: None, screen: Some(screen) }) => match screens.iter().find(|candidate| candidate.id == *screen) {
            Some(target) => {
                let area = target.work_area;
                Rect { x: area.x + (area.width - current.width) / 2, y: area.y + (area.height - current.height) / 2, ..current }
            }
            None => return Err((400, format!("There is no screen \"{screen}\"; see screens.list."))),
        },
        _ => current,
    };
    let fitted = spec::fit(wanted, options.min_size, options.max_size, &screens, wanted_screen.as_deref());
    if fitted != current {
        native.window.set_bounds(to_bounds(fitted));
    }
    change(key, |summary| {
        summary.options = options;
        summary.bounds = fitted;
        summary.screen = spec::screen_of(&screens, fitted).map(|screen| screen.id.clone());
    });
    Ok(summary_json(key))
}

pub(super) fn apply_rules(plugin_id: &str, rules: WindowRules) {
    if rules.hidden {
        close_plugin(plugin_id, Some("hidden"));
        return;
    }
    for key in keys_of(plugin_id) {
        if let Some(native) = get(&key) {
            native.rules.set(rules);
            let options = native.options.borrow().clone();
            native.window.set_look(&look(native.kind, &native.display_name, &options, rules));
        }
    }
}

fn refit(key: &Key, always_tell: bool) {
    let Some(native) = get(key) else { return };
    let screens = screen_areas();
    let current = to_rect(native.window.bounds());
    let (min, max) = {
        let options = native.options.borrow();
        (options.min_size, options.max_size)
    };
    let fitted = spec::fit(current, min, max, &screens, None);
    if fitted != current {
        native.window.set_bounds(to_bounds(fitted));
    }
    let screen = spec::screen_of(&screens, fitted).map(|screen| screen.id.clone());
    change(key, |summary| {
        summary.bounds = fitted;
        summary.screen = screen.clone();
    });
    if always_tell || fitted != current {
        tell(&key.0, "window.bounds", json!({ "id": key.1, "bounds": fitted.to_json(), "screen": screen }));
    }
}

fn displays_changed() {
    let now = Instant::now();
    let recent = LAST_DISPLAY_CHANGE.with(|last| last.get().is_some_and(|at| now.duration_since(at) < DISPLAY_CHANGE_GAP));
    if recent {
        return;
    }
    LAST_DISPLAY_CHANGE.with(|last| last.set(Some(now)));
    let keys: Vec<Key> = WINDOWS.with(|windows| windows.borrow().keys().cloned().collect());
    for key in &keys {
        refit(key, false);
    }
    let screens: Vec<Value> = screen_areas().iter().map(ScreenArea::to_json).collect();
    let plugins: BTreeSet<&String> = keys.iter().map(|(plugin, _)| plugin).collect();
    for plugin in plugins {
        tell(plugin, "screens.changed", json!({ "screens": screens }));
    }
}

fn resize(key: &Key, css_width: f64, css_height: f64) {
    let Some(native) = get(key) else { return };
    let scale = native.window.scale();
    let bounds = to_rect(native.window.bounds());
    let content = native.window.content();
    let wanted = Rect {
        width: (css_width * scale).round() as i32 + (bounds.width - content.width),
        height: (css_height * scale).round() as i32 + (bounds.height - content.height),
        ..bounds
    };
    let (min, max) = {
        let options = native.options.borrow();
        (options.min_size, options.max_size)
    };
    let fitted = spec::fit(wanted, min, max, &screen_areas(), None);
    native.window.set_bounds(to_bounds(fitted));
    refit(key, true);
}

fn user_is_on(window: &PluginWindow) -> bool {
    let recent = session_notifications::idle_millis().is_some_and(|idle| idle < RECENT_INPUT_MS);
    let bounds = window.bounds();
    let over = cursor_position().is_some_and(|point| {
        point.x >= bounds.x && point.x < bounds.x + bounds.width && point.y >= bounds.y && point.y < bounds.y + bounds.height
    });
    recent && over
}

struct Link {
    key: Key,
    kind: Kind,
    origin: String,
    root: PathBuf,
}

impl Link {
    fn native(&self) -> Option<Rc<Native>> {
        get(&self.key)
    }

    fn with_page(&self, work: impl FnOnce(&Page)) {
        if let Some(native) = self.native() {
            if let Ok(page) = native.page.try_borrow() {
                if let Some(page) = page.as_ref() {
                    work(page);
                }
            }
        }
    }

    fn later(&self, work: impl FnOnce(&Key) + Send + 'static) {
        let key = self.key.clone();
        defer(move || work(&key));
    }
}

impl WindowEvents for Link {
    fn close_requested(&self) {
        self.later(|key| close(key, Some("user")));
    }

    fn activated(&self, active: bool, by_click: bool) {
        if by_click {
            reveal::note_user_action(&self.key.0);
        }
        if self.kind != Kind::Panel {
            return;
        }
        change(&self.key, |summary| summary.focused = active);
        tell(&self.key.0, "window.focused", json!({ "id": self.key.1, "focused": active }));
        let hide_on_blur = self.native().is_some_and(|native| native.options.borrow().hide_on_blur && native.window.is_visible());
        if !active && hide_on_blur {
            self.later(|key| {
                let _ = hide(key, Some("blur"));
            });
        }
    }

    fn content_resized(&self, content: Bounds) {
        self.with_page(|page| page.place(content.x, content.y, content.width, content.height));
    }

    fn moved(&self) {
        self.with_page(Page::parent_moved);
    }

    fn user_moved(&self, _: Bounds) {
        reveal::note_user_action(&self.key.0);
        self.later(|key| refit(key, true));
    }

    fn displays_changed(&self) {
        defer(displays_changed);
    }

    fn caption_used(&self) {
        reveal::note_user_action(&self.key.0);
    }
}

impl PageHost for Link {
    fn resource(&self, url: &str) -> Option<Resource> {
        webviews::serve(&self.root, &self.origin, url)
    }

    fn may_navigate(&self, url: &str, frame: bool) -> bool {
        webviews::may_navigate(&self.origin, url, frame)
    }

    fn message(&self, source: &str, json: String) {
        if !webviews::may_navigate(&self.origin, source, false) {
            return;
        }
        let Ok(value) = serde_json::from_str::<Value>(&json) else { return };
        if value.get("type").and_then(Value::as_str) == Some("window") {
            match value.get("action").and_then(Value::as_str) {
                Some("close") => self.later(|key| close(key, Some("page"))),
                Some("startDrag") => {
                    if let Some(native) = self.native() {
                        reveal::note_user_action(&self.key.0);
                        native.window.start_drag();
                    }
                }
                Some("resize") => {
                    let size = |name: &str| value.get(name).and_then(Value::as_f64).filter(|size| size.is_finite() && *size > 0.0 && *size <= 20_000.0);
                    if let (Some(width), Some(height)) = (size("width"), size("height")) {
                        self.later(move |key| resize(key, width, height));
                    }
                }
                _ => {}
            }
            return;
        }
        match webviews::parse_page_message(&json) {
            Ok(webviews::PageMessage::Message(message)) => {
                if self.native().is_some_and(|native| user_is_on(&native.window)) {
                    reveal::note_user_action(&self.key.0);
                }
                tell(&self.key.0, "window.message", json!({ "id": self.key.1, "message": message }));
            }
            Ok(webviews::PageMessage::State(_)) => {}
            Err(error) => eprintln!("plugin window {}/{}: {error}", self.key.0, self.key.1),
        }
    }

    fn escape(&self) -> bool {
        if self.kind != Kind::Panel {
            return false;
        }
        self.later(|key| {
            let _ = hide(key, Some("escape"));
        });
        true
    }

    fn focused(&self) {
        if self.kind == Kind::Widget {
            if let Some(native) = self.native() {
                native.window.give_back_focus();
            }
        }
    }
}
