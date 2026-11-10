//! Clipboard history: commands, item types and the background capture service.

pub(crate) mod actions;
mod capture_pause;
mod clipboard_io;
mod command_text;
mod hotkey;
mod link_guard;
mod link_preview;
mod listener;
mod plugin_view;
mod popup;
mod preview;
mod secrets;
mod sequence;
mod service;
mod snippets;
mod store;
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

pub(crate) use hotkey::parse_shortcut_binding;
pub(crate) use capture_pause::paused as clipboard_capture_paused;
pub(crate) use plugin_view::{local_api_history, plugin_history, plugin_item};
pub(crate) use popup::WINDOW_LABEL as POPUP_WINDOW_LABEL;

const HISTORY_CHANGED_EVENT: &str = "clipboard-history-changed";

const MAIN_WINDOW_LABEL: &str = "main";

const DEFAULT_MAX_ITEMS: usize = 30;

const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+W";

// The default before Ctrl+Shift+W. Saved settings still holding it move to the new
// default; it also took over Cut (Ctrl+X) in every other program.
const LEGACY_DEFAULT_SHORTCUT: &str = "Ctrl+X";

const MIN_MAX_ITEMS: usize = 5;

const MAX_MAX_ITEMS: usize = 200;

const SHORT_DUPLICATE_WINDOW_MS: i64 = 2_000;

const MAX_NOTE_CHARACTERS: usize = 80;

static CLIPBOARD_HISTORY: OnceLock<ClipboardHistoryService> = OnceLock::new();

/// Selection translation copies via Ctrl+C and then puts the clipboard back. Captures
/// that land before this instant are the temporary copy, not something the user copied.
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
    /// Saved texts for pasting again (C24.6).
    snippets: Vec<snippets::ClipboardSnippet>,
    /// Whether copies are being recorded right now (C38): paused, or skipping the next one.
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
    /// Where the shortcut opens the history (C22): its own window by default, or the island's page.
    #[serde(default)]
    open_in: OpenIn,
    /// Where the window appears: at the pointer or in the middle of the screen.
    #[serde(default)]
    popup_position: PopupPosition,
    /// The window's width: the list alone, or the list with the picked entry beside it.
    #[serde(default)]
    popup_layout: PopupLayout,
    /// Picking an entry in the window pastes it into the window that was in front.
    #[serde(default = "default_true")]
    auto_paste: bool,
    /// Pasting an image into a terminal pastes its file path, which Claude Code takes as an image.
    #[serde(default = "default_true")]
    terminal_image_path: bool,
    /// Entries older than this many days go, favourites aside; 0 keeps them until `max_items`.
    #[serde(default)]
    retention_days: u32,
    /// Skips what password managers mark as not for clipboard history.
    #[serde(default = "default_true")]
    skip_sensitive: bool,
    /// Win+V opens the history instead of Windows' own clipboard history (C22.3).
    #[serde(default)]
    win_v: bool,
    /// What happens to text that looks like a key or token (C24.1).
    #[serde(default)]
    secrets: SecretHandling,
    /// Executable names (lower case, e.g. "keepass.exe") whose copies are not recorded (C24.2).
    #[serde(default)]
    excluded_apps: Vec<String>,
    /// Records files copied in Explorer (C24.3).
    #[serde(default = "default_true")]
    capture_files: bool,
    /// Keeps the HTML next to copied text, for pasting with formatting (C24.4).
    #[serde(default = "default_true")]
    capture_html: bool,
    /// Reads the text in recorded images with Windows' own OCR, on this computer (C24.9).
    #[serde(default = "default_true")]
    ocr: bool,
    /// Keeps the clipboard window out of screen sharing and recordings (C38).
    #[serde(default = "default_true")]
    hide_from_capture: bool,
    /// Reads a copied link's page title and icon; this visits the address (C38).
    #[serde(default)]
    link_preview: bool,
    /// A command copied over several lines goes into a terminal as one line (C38).
    #[serde(default)]
    flatten_terminal_commands: bool,
    /// The local API's GET /v1/clipboard may read the history, for AI tools (C38).
    #[serde(default)]
    local_api_read: bool,
    /// The user's own prompts for "Rewrite with AI" (C43).
    #[serde(default)]
    ai_prompts: Vec<AiPrompt>,
}

/// A prompt of the user's own for the clipboard window's AI rewrites (C43).
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

/// Prompts with a title and text, both cut to their limits, ids unique, at most MAX_AI_PROMPTS.
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
    /// Recorded, but shown as its first characters and dots until revealed.
    #[default]
    Mask,
    Skip,
    Keep,
}

/// The program an entry was copied from (C24.2).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardSource {
    /// Full path of the executable, for its icon.
    path: String,
    /// Its file name without ".exe".
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
        // The default parses to its own label (see hotkey tests), so falling back
        // to the constant matches falling back to its parsed binding.
        self.shortcut = parse_shortcut_binding(&self.shortcut)
            .filter(|binding| binding.label != LEGACY_DEFAULT_SHORTCUT)
            .map_or_else(default_clipboard_shortcut, |binding| binding.label);
        self
    }
}

/// How an item goes back on the clipboard (C22.1): as copied, or for an image the saved PNG as a
/// file (bitmap, PNG and CF_HDROP) or its quoted path as text. Text items always go as text.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CopyAs {
    #[default]
    Original,
    File,
    Path,
    /// Text without its formatting; files and images as their paths (C24.4).
    Plain,
    /// The text OCR read in an image (C24.9).
    Text,
    /// A text entry as a .txt file (C38).
    TextFile,
}

#[derive(Clone)]
pub(crate) struct ShortcutBinding {
    pub(crate) label: String,
    pub(crate) modifiers: u32,
    pub(crate) key_code: u32,
}

fn default_true() -> bool {
    true
}

fn default_clipboard_shortcut() -> String {
    DEFAULT_SHORTCUT.to_string()
}

/// Always `Some`: the constant is a valid shortcut (checked by a hotkey test).
fn default_shortcut_binding() -> Option<ShortcutBinding> {
    parse_shortcut_binding(DEFAULT_SHORTCUT)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ClipboardHistoryItemKind {
    /// Files copied in Explorer (C24.3); older history files never have it.
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
    /// The text as HTML (C24.4).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    html: Option<String>,
    /// The paths of a files entry (C24.3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    files: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source: Option<ClipboardSource>,
    /// Tags the user gave it (C24.5).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
    /// Text Windows' OCR read in an image (C24.9).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ocr_text: Option<String>,
    /// Looks like a key or token: the preview is masked (C24.1).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    masked: bool,
}

/// Lower-case executable names, without blanks or duplicates, at most MAX_EXCLUDED_APPS.
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

/// A note as typed, split into its words and its "#tag" words (C24.5): "#work meeting link" is the
/// note "meeting link" with the tag "work". The note is capped at MAX_NOTE_CHARACTERS.
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

/// Tags as the user typed them: trimmed, without a leading '#', no blanks or duplicates, capped.
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
    /// The entry deleted last and where it was, while it can be undone (C42).
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

/// Why the clipboard shortcut could not be registered, or null when it is fine or off.
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

/// `copy_clipboard_history_item` with a choice of form for images (`file` or `path`).
#[tauri::command]
pub fn copy_clipboard_history_item_as(id: String, copy_as: CopyAs) -> Result<ClipboardHistorySnapshot, String> {
    service()?.copy_item_as(&id, copy_as)
}

/// From the clipboard window: puts the entry on the clipboard and pastes it into the window that
/// was in front (C22.2); `enter` presses Enter after it, `copy_as` picks the form (C38).
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

/// From the clipboard window: fills in the snippet's variables and pastes it like an entry (C24.6).
#[tauri::command]
pub async fn paste_clipboard_snippet(app: AppHandle, id: String) -> Result<(), String> {
    let text = service()?.snippet_text(&id)?;
    popup::paste_text(&app, &text, false)
}

/// From the clipboard window: pastes the first of `ids` now and each next one on the user's
/// following Ctrl+V (C24.7).
#[tauri::command]
pub async fn paste_clipboard_sequence(app: AppHandle, ids: Vec<String>) -> Result<(), String> {
    sequence::start(&app, ids)
}

/// Writes the history and snippets to a JSON file in Downloads and returns its path (C24.8).
#[tauri::command]
pub async fn export_clipboard_history() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| service()?.export())
        .await
        .map_err(|error| format!("Failed to join the export: {error}"))?
}

/// Adds what an exported file holds and this history does not (C24.8).
#[tauri::command]
pub async fn import_clipboard_history(content: String) -> Result<transfer::ImportReport, String> {
    tauri::async_runtime::spawn_blocking(move || service()?.import(&content))
        .await
        .map_err(|error| format!("Failed to join the import: {error}"))?
}

/// A larger copy of an image entry for the clipboard window's side pane; null for other entries.
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

/// Undoes the last delete, while it can be (C42).
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

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let history_path = app_dir.join(HISTORY_FILE_NAME);
    let image_dir = app_dir.join(IMAGE_DIRECTORY_NAME);

    fs::create_dir_all(&image_dir)
        .map_err(|error| format!("Failed to create clipboard history directory: {error}"))?;

    let persisted = load_history(&history_path);
    // Images of an entry deleted just before the app last quit (C42). Never with an empty list: a
    // history that failed to load must not take the images with it.
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

/// This module's Tauri commands. `lib.rs` chains every module's list into one
/// `generate_handler!`, so adding a command only touches this file.
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
