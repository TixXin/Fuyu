pub(crate) mod actions;
mod capture_pause;
mod clipboard_io;
mod command_text;
#[cfg_attr(target_os = "macos", path = "hotkey_macos.rs")]
mod hotkey;
mod link_guard;
mod link_preview;
#[cfg_attr(target_os = "macos", path = "listener_macos.rs")]
mod listener;
mod plugin_view;
#[cfg_attr(target_os = "macos", path = "popup_macos.rs")]
mod popup;
mod popup_place;
mod preview;
mod secrets;
mod sequence;
#[cfg(target_os = "macos")]
mod sequence_watch_macos;
mod service;
pub(crate) mod shortcut;
#[cfg(target_os = "macos")]
mod shortcut_macos;
mod snippets;
mod store;
#[cfg_attr(target_os = "macos", path = "system_macos.rs")]
mod system;
mod transfer;

use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

use listener::{notify_clipboard_changed, start_workers};
use store::{load_history, HISTORY_FILE_NAME, IMAGE_DIRECTORY_NAME};

pub(crate) use shortcut::{parse_shortcut_binding, ShortcutBinding};
#[cfg(target_os = "macos")]
pub(crate) use shortcut_macos::to_hotkey;
pub(crate) use capture_pause::paused as clipboard_capture_paused;
pub(crate) use plugin_view::{local_api_history, plugin_history, plugin_item};
pub(crate) use popup::WINDOW_LABEL as POPUP_WINDOW_LABEL;

const HISTORY_CHANGED_EVENT: &str = "clipboard-history-changed";

const DEFAULT_MAX_ITEMS: usize = 30;

#[cfg(not(target_os = "macos"))]
const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+W";
#[cfg(target_os = "macos")]
const DEFAULT_SHORTCUT: &str = "Shift+Win+V";

const LEGACY_DEFAULT_SHORTCUT: &str = "Ctrl+X";

const MIN_MAX_ITEMS: usize = 5;

const MAX_MAX_ITEMS: usize = 200;

const SHORT_DUPLICATE_WINDOW_MS: i64 = 2_000;

const MAX_NOTE_CHARACTERS: usize = 80;

static CLIPBOARD_HISTORY: OnceLock<ClipboardHistoryService> = OnceLock::new();

static CAPTURE_SUSPENDED_UNTIL: Mutex<Option<Instant>> = Mutex::new(None);

pub(crate) fn suspend_clipboard_capture(duration: Duration) {
    let until = Instant::now() + duration;
    let Ok(mut slot) = CAPTURE_SUSPENDED_UNTIL.lock() else {
        return;
    };
    if slot.is_none_or(|current| current < until) {
        *slot = Some(until);
    }
}

pub(crate) fn clipboard_capture_suspended() -> bool {
    CAPTURE_SUSPENDED_UNTIL
        .lock()
        .ok()
        .and_then(|slot| *slot)
        .is_some_and(|until| Instant::now() < until)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardHistorySnapshot {
    settings: ClipboardHistorySettings,
    items: Vec<ClipboardHistoryItem>,
    snippets: Vec<snippets::ClipboardSnippet>,
    #[serde(default)]
    capture: capture_pause::CaptureStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardHistorySettings {
    enabled: bool,
    capture_images: bool,
    max_items: usize,
    #[serde(default = "default_clipboard_shortcut")]
    shortcut: String,
    #[serde(default = "default_true")]
    shortcut_enabled: bool,
    #[serde(default)]
    open_in: OpenIn,
    #[serde(default)]
    popup_position: PopupPosition,
    #[serde(default)]
    popup_layout: PopupLayout,
    #[serde(default = "default_true")]
    auto_paste: bool,
    #[serde(default = "default_true")]
    terminal_image_path: bool,
    #[serde(default)]
    retention_days: u32,
    #[serde(default = "default_true")]
    skip_sensitive: bool,
    #[serde(default)]
    win_v: bool,
    #[serde(default)]
    secrets: SecretHandling,
    #[serde(default)]
    excluded_apps: Vec<String>,
    #[serde(default = "default_true")]
    capture_files: bool,
    #[serde(default = "default_true")]
    capture_html: bool,
    #[serde(default = "default_true")]
    ocr: bool,
    #[serde(default = "default_true")]
    hide_from_capture: bool,
    #[serde(default)]
    link_preview: bool,
    #[serde(default)]
    flatten_terminal_commands: bool,
    #[serde(default)]
    local_api_read: bool,
    #[serde(default)]
    ai_prompts: Vec<AiPrompt>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPrompt {
    id: String,
    title: String,
    prompt: String,
}

const MAX_AI_PROMPTS: usize = 20;
const MAX_AI_PROMPT_TITLE: usize = 24;
const MAX_AI_PROMPT_CHARACTERS: usize = 2_000;

fn normalized_ai_prompts(prompts: &[AiPrompt]) -> Vec<AiPrompt> {
    let mut kept: Vec<AiPrompt> = Vec::new();
    for prompt in prompts {
        let title: String = prompt.title.trim().chars().take(MAX_AI_PROMPT_TITLE).collect();
        let text: String = prompt.prompt.trim().chars().take(MAX_AI_PROMPT_CHARACTERS).collect();
        let id = prompt.id.trim().chars().take(64).collect::<String>();
        if title.is_empty() || text.is_empty() || id.is_empty() || kept.iter().any(|kept| kept.id == id) || kept.len() == MAX_AI_PROMPTS {
            continue;
        }
        kept.push(AiPrompt { id, title, prompt: text });
    }
    kept
}

#[cfg(test)]
#[test]
fn ai_prompts_need_a_title_and_text_and_stay_few() {
    let prompt = |id: &str, title: &str, text: &str| AiPrompt { id: id.into(), title: title.into(), prompt: text.into() };
    let kept = normalized_ai_prompts(&[prompt("a", " 邮件 ", " 改成正式邮件 "), prompt("a", "dup", "x"), prompt("b", "", "x"), prompt("c", "t", "  ")]);
    assert_eq!(kept, [prompt("a", "邮件", "改成正式邮件")]);
    let many: Vec<AiPrompt> = (0..30).map(|index| prompt(&index.to_string(), "t", "x")).collect();
    assert_eq!(normalized_ai_prompts(&many).len(), MAX_AI_PROMPTS);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SecretHandling {
    #[default]
    Mask,
    Skip,
    Keep,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardSource {
    path: String,
    name: String,
}

const MAX_EXCLUDED_APPS: usize = 50;
const MAX_TAGS: usize = 8;
const MAX_TAG_CHARACTERS: usize = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum OpenIn {
    #[default]
    Window,
    Island,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PopupPosition {
    #[default]
    Cursor,
    Center,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PopupLayout {
    #[default]
    Standard,
    Wide,
}

const MAX_RETENTION_DAYS: u32 = 365;

impl Default for ClipboardHistorySettings {
    fn default() -> Self {
        Self {
            enabled: true,
            capture_images: true,
            max_items: DEFAULT_MAX_ITEMS,
            shortcut: default_clipboard_shortcut(),
            shortcut_enabled: true,
            open_in: OpenIn::Window,
            popup_position: PopupPosition::Cursor,
            popup_layout: PopupLayout::Standard,
            auto_paste: true,
            terminal_image_path: true,
            retention_days: 0,
            skip_sensitive: true,
            win_v: false,
            secrets: SecretHandling::Mask,
            excluded_apps: Vec::new(),
            capture_files: true,
            capture_html: true,
            ocr: true,
            hide_from_capture: true,
            link_preview: false,
            flatten_terminal_commands: false,
            local_api_read: false,
            ai_prompts: Vec::new(),
        }
    }
}

impl ClipboardHistorySettings {
    fn normalized(mut self) -> Self {
        self.max_items = self.max_items.clamp(MIN_MAX_ITEMS, MAX_MAX_ITEMS);
        self.retention_days = self.retention_days.min(MAX_RETENTION_DAYS);
        self.excluded_apps = normalized_app_names(&self.excluded_apps);
        self.ai_prompts = normalized_ai_prompts(&self.ai_prompts);
        self.shortcut = parse_shortcut_binding(&self.shortcut)
            .filter(|binding| binding.label != LEGACY_DEFAULT_SHORTCUT)
            .map_or_else(default_clipboard_shortcut, |binding| binding.label);
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CopyAs {
    #[default]
    Original,
    File,
    Path,
    Plain,
    Text,
    TextFile,
}

fn default_true() -> bool {
    true
}

fn default_clipboard_shortcut() -> String {
    DEFAULT_SHORTCUT.to_string()
}

fn default_shortcut_binding() -> Option<ShortcutBinding> {
    parse_shortcut_binding(DEFAULT_SHORTCUT)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ClipboardHistoryItemKind {
    Files,
    Text,
    Image,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardHistoryItem {
    id: String,
    kind: ClipboardHistoryItemKind,
    hash: String,
    created_at: i64,
    copied_at: i64,
    #[serde(default)]
    favorite: bool,
    #[serde(default)]
    note: String,
    preview: String,
    text: Option<String>,
    image: Option<ClipboardHistoryImage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    html: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    files: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source: Option<ClipboardSource>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ocr_text: Option<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    masked: bool,
}

fn normalized_app_names(names: &[String]) -> Vec<String> {
    let mut seen = Vec::new();
    for name in names {
        let name = name.trim().to_lowercase();
        if !name.is_empty() && !seen.contains(&name) && seen.len() < MAX_EXCLUDED_APPS {
            seen.push(name);
        }
    }
    seen
}

pub(crate) fn split_note_tags(note: &str) -> (String, Vec<String>) {
    let (tags, words): (Vec<&str>, Vec<&str>) = note
        .split_whitespace()
        .partition(|word| word.len() > 1 && (word.starts_with('#') || word.starts_with('＃')));
    let tags: Vec<String> = tags.iter().map(|tag| tag.trim_start_matches(['#', '＃']).to_string()).collect();
    (words.join(" ").chars().take(MAX_NOTE_CHARACTERS).collect(), normalized_tags(&tags))
}

#[cfg(test)]
#[test]
fn notes_give_their_hash_words_as_tags() {
    let (note, tags) = split_note_tags("#Work  meeting link #ops #work ＃周报");
    assert_eq!(note, "meeting link");
    assert_eq!(tags, ["Work", "ops", "周报"]);
    assert_eq!(split_note_tags("# alone"), ("# alone".to_string(), Vec::<String>::new()));
}

pub(crate) fn normalized_tags(tags: &[String]) -> Vec<String> {
    let mut kept: Vec<String> = Vec::new();
    for tag in tags {
        let tag: String = tag.trim().trim_start_matches('#').trim().chars().take(MAX_TAG_CHARACTERS).collect();
        if !tag.is_empty() && !kept.iter().any(|kept| kept.eq_ignore_ascii_case(&tag)) && kept.len() < MAX_TAGS {
            kept.push(tag);
        }
    }
    kept
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardHistoryImage {
    width: usize,
    height: usize,
    byte_size: u64,
    original_path: String,
    thumbnail_path: String,
    thumbnail_data_url: Option<String>,
}

struct ClipboardHistoryState {
    settings: ClipboardHistorySettings,
    items: Vec<ClipboardHistoryItem>,
    snippets: Vec<snippets::ClipboardSnippet>,
    last_capture_hash: Option<String>,
    recently_deleted: Option<(ClipboardHistoryItem, usize)>,
}

struct ClipboardHistoryService {
    app: AppHandle,
    history_path: PathBuf,
    image_dir: PathBuf,
    state: Mutex<ClipboardHistoryState>,
}

#[tauri::command]
pub fn get_clipboard_history() -> Result<ClipboardHistorySnapshot, String> {
    service()?.snapshot()
}

#[tauri::command]
pub fn get_clipboard_shortcut_error() -> Option<String> {
    hotkey::hotkey_error()
}

#[tauri::command]
pub fn set_clipboard_history_settings(
    settings: ClipboardHistorySettings,
) -> Result<ClipboardHistorySnapshot, String> {
    service()?.set_settings(settings)
}

#[tauri::command]
pub fn copy_clipboard_history_item(id: String) -> Result<ClipboardHistorySnapshot, String> {
    service()?.copy_item(&id)
}

#[tauri::command]
pub fn copy_clipboard_history_item_as(id: String, copy_as: CopyAs) -> Result<ClipboardHistorySnapshot, String> {
    service()?.copy_item_as(&id, copy_as)
}

#[tauri::command]
pub async fn paste_clipboard_history_item(
    app: AppHandle,
    id: String,
    plain: Option<bool>,
    enter: Option<bool>,
    copy_as: Option<CopyAs>,
) -> Result<(), String> {
    let options = popup::PasteOptions { plain: plain.unwrap_or(false), enter: enter.unwrap_or(false), copy_as };
    popup::paste(&app, &id, options)
}

#[tauri::command]
pub fn save_clipboard_snippet(id: Option<String>, title: String, text: String) -> Result<ClipboardHistorySnapshot, String> {
    service()?.save_snippet(id.as_deref(), &title, &text)
}

#[tauri::command]
pub fn delete_clipboard_snippet(id: String) -> Result<ClipboardHistorySnapshot, String> {
    service()?.delete_snippet(&id)
}

#[tauri::command]
pub async fn paste_clipboard_snippet(app: AppHandle, id: String) -> Result<(), String> {
    let text = service()?.snippet_text(&id)?;
    popup::paste_text(&app, &text, false)
}

#[tauri::command]
pub async fn paste_clipboard_sequence(app: AppHandle, ids: Vec<String>) -> Result<(), String> {
    sequence::start(&app, ids)
}

#[tauri::command]
pub async fn export_clipboard_history() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| service()?.export())
        .await
        .map_err(|error| format!("Failed to join the export: {error}"))?
}

#[tauri::command]
pub async fn import_clipboard_history(content: String) -> Result<transfer::ImportReport, String> {
    tauri::async_runtime::spawn_blocking(move || service()?.import(&content))
        .await
        .map_err(|error| format!("Failed to join the import: {error}"))?
}

#[tauri::command]
pub async fn get_clipboard_image_preview(id: String) -> Result<Option<String>, String> {
    let path = service()?
        .snapshot()?
        .items
        .into_iter()
        .find(|item| item.id == id)
        .and_then(|item| item.image.map(|image| image.original_path));
    let Some(path) = path else { return Ok(None) };
    tauri::async_runtime::spawn_blocking(move || preview::image_data_url(std::path::Path::new(&path)).map(Some))
        .await
        .map_err(|error| format!("Failed to join the image preview task: {error}"))?
}

#[tauri::command]
pub async fn hide_clipboard_popup(app: AppHandle) -> Result<(), String> {
    popup::hide(&app)
}

#[tauri::command]
pub fn toggle_clipboard_history_favorite(id: String) -> Result<ClipboardHistorySnapshot, String> {
    service()?.toggle_favorite(&id)
}

#[tauri::command]
pub fn set_clipboard_history_item_note(
    id: String,
    note: String,
) -> Result<ClipboardHistorySnapshot, String> {
    service()?.set_note(&id, &note)
}

#[tauri::command]
pub fn delete_clipboard_history_item(id: String) -> Result<ClipboardHistorySnapshot, String> {
    service()?.delete_item(&id)
}

#[tauri::command]
pub fn restore_clipboard_history_item(id: String) -> Result<ClipboardHistorySnapshot, String> {
    service()?.restore_item(&id)
}

#[tauri::command]
pub fn clear_clipboard_history() -> Result<ClipboardHistorySnapshot, String> {
    service()?.clear()
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    if CLIPBOARD_HISTORY.get().is_some() {
        return Ok(());
    }

    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let history_path = app_dir.join(HISTORY_FILE_NAME);
    let image_dir = app_dir.join(IMAGE_DIRECTORY_NAME);

    fs::create_dir_all(&image_dir)
        .map_err(|error| format!("Failed to create clipboard history directory: {error}"))?;

    let persisted = load_history(&history_path);
    if !persisted.items.is_empty() {
        let (dir, items) = (image_dir.clone(), persisted.items.clone());
        std::thread::spawn(move || service::remove_unreferenced_images(&dir, &items));
    }
    let service = ClipboardHistoryService {
        app: app.clone(),
        history_path,
        image_dir,
        state: Mutex::new(ClipboardHistoryState {
            settings: persisted.settings.normalized(),
            items: persisted.items,
            snippets: persisted.snippets,
            last_capture_hash: None,
            recently_deleted: None,
        }),
    };

    let _ = CLIPBOARD_HISTORY.set(service);
    start_workers();
    notify_clipboard_changed();
    Ok(())
}

fn service() -> Result<&'static ClipboardHistoryService, String> {
    CLIPBOARD_HISTORY
        .get()
        .ok_or_else(|| "Clipboard history service is not initialized.".to_string())
}

fn current_unix_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::clipboard_history::get_clipboard_history,
            crate::clipboard_history::set_clipboard_history_settings,
            crate::clipboard_history::get_clipboard_shortcut_error,
            crate::clipboard_history::copy_clipboard_history_item,
            crate::clipboard_history::copy_clipboard_history_item_as,
            crate::clipboard_history::paste_clipboard_history_item,
            crate::clipboard_history::hide_clipboard_popup,
            crate::clipboard_history::paste_clipboard_sequence,
            crate::clipboard_history::export_clipboard_history,
            crate::clipboard_history::import_clipboard_history,
            crate::clipboard_history::save_clipboard_snippet,
            crate::clipboard_history::delete_clipboard_snippet,
            crate::clipboard_history::paste_clipboard_snippet,
            crate::clipboard_history::toggle_clipboard_history_favorite,
            crate::clipboard_history::set_clipboard_history_item_note,
            crate::clipboard_history::delete_clipboard_history_item,
            crate::clipboard_history::restore_clipboard_history_item,
            crate::clipboard_history::clear_clipboard_history,
            crate::clipboard_history::get_clipboard_image_preview,
            crate::clipboard_history::actions::paste_clipboard_text,
            crate::clipboard_history::actions::add_clipboard_history_text,
            crate::clipboard_history::actions::pause_clipboard_capture,
            crate::clipboard_history::actions::resume_clipboard_capture,
            crate::clipboard_history::actions::ignore_next_clipboard_copy,
            crate::clipboard_history::actions::convert_chinese_text,
            crate::clipboard_history::actions::read_clipboard_image_qr,
            crate::clipboard_history::actions::get_clipboard_link_preview,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
