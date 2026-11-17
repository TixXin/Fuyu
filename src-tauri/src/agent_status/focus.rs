use std::path::Path;

use super::editor_terminal::{self, EditorTerminal};
use super::focus_log::Attempt;
use super::orca;
use super::session_host;
use super::session_memory::{self, SeenSession};
use super::session_process::{ancestor_chain, session_process_chain};
use super::session_records::{self, SessionRecord};
use super::tmux;
use super::wezterm;
use super::window_focus::{self, app_name, SessionHints};
use super::{antigravity, antigravity_focus, dsh, opencode, trae, workbuddy};
use crate::system::windows_home_dir;
use crate::platform;

const WINDOWS_TERMINAL_APP: &str = "windowsterminal";
const SINGLE_SESSION_TERMINALS: &[&str] = &["cmd", "powershell", "pwsh", "mintty"];

const MAX_ANCESTORS: usize = 4;

pub(super) fn folder_names(cwd: &str) -> (Option<String>, Vec<String>) {
    let mut names = cwd
        .trim_end_matches(['\\', '/'])
        .split(['\\', '/'])
        .filter(|part| !part.is_empty() && !part.ends_with(':'))
        .rev()
        .map(str::to_string);
    let folder = names.next();
    (folder, names.take(MAX_ANCESTORS).collect())
}

pub(super) fn still_running(seen: &SeenSession, started_now: Option<u64>) -> bool {
    started_now.is_some() && seen.started.is_none_or(|started| Some(started) == started_now)
}

fn process_chain(
    is_codex: bool,
    session_id: Option<&str>,
    record: Option<&SessionRecord>,
    seen: Option<&SeenSession>,
    log: &mut Attempt,
) -> Vec<u32> {
    let Some(id) = session_id else {
        return Vec::new();
    };
    if let Some(pid) = record.and_then(SessionRecord::live_pid) {
        let chain = ancestor_chain(pid, &platform::process_tree::parent_process_ids(), platform::process_times::start_time);
        log.note(format!("process=hook({})", chain.len()));
        return chain;
    }
    if let (false, Ok(home_dir)) = (is_codex, windows_home_dir()) {
        let chain = session_process_chain(&home_dir, id);
        if !chain.is_empty() {
            log.note(format!("process=registry({})", chain.len()));
            return chain;
        }
    }
    match seen {
        Some(seen) if still_running(seen, platform::process_times::start_time(seen.pid)) => {
            let chain = ancestor_chain(seen.pid, &platform::process_tree::parent_process_ids(), platform::process_times::start_time);
            log.note(format!("process=remembered({})", chain.len()));
            chain
        }
        Some(_) => {
            log.note("process=ended");
            Vec::new()
        }
        None => {
            log.note("process=unknown");
            Vec::new()
        }
    }
}

struct Lookup<'a> {
    app_dir: Option<&'a Path>,
    record: Option<&'a SessionRecord>,
    is_codex: bool,
    session_id: Option<&'a str>,
    cwd: Option<&'a str>,
    title: Option<&'a str>,
}

fn orca_handle(lookup: &Lookup, chain: &[u32], seen: Option<&SeenSession>, log: &mut Attempt) -> Option<String> {
    let found = |source: &str, handle: Option<String>, log: &mut Attempt| {
        if handle.is_some() {
            log.note(format!("tab={source}"));
        }
        handle
    };
    if let Some(handle) = found("process", chain.first().and_then(|&pid| orca::terminal_handle_of_process(pid)), log) {
        return Some(handle);
    }
    if let Some(handle) = found("hook", lookup.record.and_then(SessionRecord::orca_handle), log) {
        return Some(handle);
    }
    if let Some(handle) = found("remembered", seen.and_then(|seen| seen.orca_handle.clone()), log) {
        return Some(handle);
    }
    let record = lookup.session_id.zip(lookup.app_dir).and_then(|(id, app_dir)| orca::terminal_handle_for(app_dir, id));
    if let Some(handle) = found("hook-orca", record, log) {
        return Some(handle);
    }
    if !chain.is_empty() {
        return None;
    }
    let orca_exe = window_focus::open_app_exe(orca::ORCA_APP)?;
    let Some(list) = orca::list_terminals(Path::new(&orca_exe)) else {
        log.note("tab=orca-list-failed");
        return None;
    };
    let agent = if lookup.is_codex { "codex" } else { "claude" };
    let by_title = lookup.title.and_then(|title| orca::agent_terminal_titled(&list, agent, title));
    if let Some(handle) = found("orca-title", by_title, log) {
        return Some(handle);
    }
    let by_folder = lookup.cwd.filter(|_| lookup.is_codex).and_then(|cwd| orca::only_agent_terminal(&list, agent, cwd));
    found("orca-folder", by_folder, log)
}

fn provider_apps(provider: &str, app_dir: Option<&Path>, session_id: Option<&str>, log: &mut Attempt) -> Vec<String> {
    match provider {
        antigravity::PROVIDER => {
            let product = app_dir.zip(session_id).and_then(|(dir, id)| antigravity_focus::session_product(dir, id));
            if let Some(product) = product {
                log.note(format!("product={}", product.label()));
            }
            antigravity_focus::apps_for(product)
        }
        _ => match provider {
            workbuddy::PROVIDER => workbuddy::running_app(),
            dsh::PROVIDER => dsh::running_app(),
            opencode::PROVIDER => opencode::running_app(),
            trae::PROVIDER => Some(trae::APP.to_string()),
            trae::CN_PROVIDER => Some(trae::CN_APP.to_string()),
            _ => None,
        }
        .into_iter()
        .collect(),
    }
}

#[derive(Default)]
pub(super) struct FocusSteps {
    pub(super) has_chain: bool,
    pub(super) orca_switched: bool,
    pub(super) wezterm_selected: bool,
    pub(super) tmux_selected: bool,
    pub(super) mac_tab: Option<bool>,
    pub(super) wt_selected: bool,
    pub(super) editor_sent: bool,
}

pub(super) fn is_exact_focus(app: &str, steps: &FocusSteps) -> bool {
    steps.orca_switched
        || steps.wezterm_selected
        || steps.wt_selected
        || steps.editor_sent
        || steps.mac_tab == Some(true)
        || (steps.tmux_selected && steps.mac_tab != Some(false))
        || (SINGLE_SESSION_TERMINALS.contains(&app) && steps.has_chain)
        || (cfg!(windows) && app == "alacritty" && steps.has_chain)
}

#[cfg(target_os = "macos")]
fn session_tty(chain: &[u32], tmux_target: Option<&tmux::TmuxTarget>) -> Option<String> {
    let override_tty = tmux_target.and_then(|target| target.client_tty.as_deref());
    window_focus::session_tty(chain, override_tty)
}

#[cfg(not(target_os = "macos"))]
fn session_tty(_chain: &[u32], _tmux_target: Option<&tmux::TmuxTarget>) -> Option<String> {
    None
}

pub(super) struct Focused {
    pub(super) found: bool,
    pub(super) exact: bool,
    pub(super) focused_app: Option<(String, String)>,
    pub(super) missing_extension: Option<String>,
}

pub(super) fn focus_session(
    app_dir: Option<&Path>,
    provider: &str,
    cwd: Option<&str>,
    title: Option<&str>,
    session_id: Option<&str>,
) -> Focused {
    let is_codex = provider == "codex";
    let session_id = session_id.filter(|id| !id.is_empty());
    let mut log = Attempt::new(provider, session_id);
    let seen = session_id.and_then(|id| session_memory::get(app_dir, id));
    let record = session_id.zip(app_dir).and_then(|(id, dir)| session_records::read(dir, id));
    if record.is_some() {
        log.note("record=yes");
    }
    let mut chain = process_chain(is_codex, session_id, record.as_ref(), seen.as_ref(), &mut log);
    let tmux_target = tmux::resolve(&chain);
    if let Some(target) = &tmux_target {
        log.note("tmux=pane");
        for &pid in &target.client_chain {
            if !chain.contains(&pid) {
                chain.push(pid);
            }
        }
    }
    let tty = session_tty(&chain, tmux_target.as_ref());
    let lookup = Lookup { app_dir, record: record.as_ref(), is_codex, session_id, cwd, title };
    let handle = orca_handle(&lookup, &chain, seen.as_ref(), &mut log);

    let remembered_app = seen.as_ref().and_then(|seen| seen.host_exe.as_deref()).map(app_name);
    let prefer_apps: Vec<String> = match if handle.is_some() { Some(orca::ORCA_APP.to_string()) } else { remembered_app } {
        Some(app) => vec![app],
        None => provider_apps(provider, app_dir, session_id, &mut log),
    };
    if !prefer_apps.is_empty() {
        log.note(format!("prefer={}", prefer_apps.join("|")));
    }
    let (folder, ancestors) = cwd.map(folder_names).unwrap_or_default();
    let hints = SessionHints { folder: folder.as_deref(), ancestors: &ancestors, title, is_codex };
    let mut steps = FocusSteps { has_chain: !chain.is_empty(), ..FocusSteps::default() };
    let focused = window_focus::focus_session_window(&hints, &chain, &prefer_apps).or_else(|| {
        steps.wezterm_selected = wezterm::activate_pane(None, tty.as_deref(), title);
        steps.wezterm_selected.then(|| window_focus::focus_session_window(&hints, &chain, &wezterm::prefer_apps()))?
    });
    if steps.wezterm_selected {
        log.note("wezterm-tab=selected");
    }
    let Some(focused) = focused else {
        log.finish(app_dir, "not found");
        return Focused { found: false, exact: false, focused_app: None, missing_extension: None };
    };
    log.note(format!("window={}", focused.app));
    let focused_exe = platform::process::image_path(focused.process_id);
    if let Some(handle) = handle.filter(|_| focused.app == orca::ORCA_APP) {
        steps.orca_switched = focused_exe
            .as_deref()
            .is_some_and(|orca_exe| orca::switch_terminal(Path::new(orca_exe), &handle));
        log.note(if steps.orca_switched { "switch=sent" } else { "switch=failed" });
    }
    if wezterm::is_app(&focused.app) && !steps.wezterm_selected {
        steps.wezterm_selected = wezterm::activate_pane(focused_exe.as_deref().map(Path::new), tty.as_deref(), title);
        log.note(if steps.wezterm_selected { "wezterm-tab=selected" } else { "wezterm-tab=none" });
    }
    if let Some(target) = &tmux_target {
        steps.tmux_selected = tmux::select(target);
        log.note(if steps.tmux_selected { "tmux=selected" } else { "tmux=none" });
    }
    #[cfg(target_os = "macos")]
    {
        let override_tty = tmux_target.as_ref().and_then(|target| target.client_tty.as_deref());
        steps.mac_tab = window_focus::select_mac_terminal_tab(&focused, &chain, override_tty);
        if let Some(selected) = steps.mac_tab {
            log.note(if selected { "mac-tab=selected" } else { "mac-tab=none" });
        }
    }
    if let Some(title) = title.filter(|_| focused.app == WINDOWS_TERMINAL_APP) {
        steps.wt_selected = window_focus::select_terminal_tab(&focused, title);
        log.note(if steps.wt_selected { "wt-tab=selected" } else { "wt-tab=none" });
    }
    let mut missing_extension = None;
    let is_native_trae = matches!(provider, trae::PROVIDER | trae::CN_PROVIDER);
    if !is_native_trae {
        if let (true, Ok(home_dir)) = (focused.in_front, windows_home_dir()) {
            let shown = editor_terminal::show_session_terminal(&home_dir, &focused.app, &chain, title);
            match shown {
                Some(EditorTerminal::Sent) => {
                    steps.editor_sent = true;
                    log.note("editor-terminal=sent");
                }
                Some(EditorTerminal::NoExtension) => {
                    log.note("editor-terminal=no-extension");
                    missing_extension = Some(focused.app.clone());
                }
                Some(EditorTerminal::Failed) => log.note("editor-terminal=failed"),
                None => {}
            }
        }
    }
    let exact = is_exact_focus(&focused.app, &steps);
    let display_name = session_host::app_display_name(&focused.app, focused_exe.as_deref());
    log.finish(app_dir, if focused.in_front { "focused" } else { "found, flashed (Windows kept it behind)" });
    Focused {
        found: true,
        exact,
        focused_app: Some((focused.app, display_name)),
        missing_extension,
    }
}

#[cfg(windows)]
fn foreground_process_id() -> u32 {
    crate::win32::process::window_process_id(crate::win32::window::foreground_window())
}

#[cfg(target_os = "macos")]
fn foreground_process_id() -> u32 {
    crate::macos::apps::frontmost_pid().and_then(|pid| u32::try_from(pid).ok()).unwrap_or(0)
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRef {
    provider: String,
    session_id: String,
}

pub(super) fn sessions_in_front(app_dir: Option<&Path>, sessions: &[SessionRef]) -> Vec<String> {
    let front = foreground_process_id();
    let front_app = platform::process::image_path(front).map(|path| app_name(&path));
    if front == 0 || front_app.is_none_or(|app| window_focus::NOT_SESSION_HOSTS.contains(&app.as_str())) {
        return Vec::new();
    }
    sessions
        .iter()
        .filter(|session| {
            let id = session.session_id.as_str();
            let mut log = Attempt::new(&session.provider, Some(id));
            let seen = session_memory::get(app_dir, id);
            let record = app_dir.and_then(|dir| session_records::read(dir, id));
            process_chain(session.provider == "codex", Some(id), record.as_ref(), seen.as_ref(), &mut log).contains(&front)
        })
        .map(|session| session.session_id.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{is_exact_focus, FocusSteps};

    #[test]
    fn distinguishes_exact_tab_focus_from_window_only_focus() {
        assert!(!is_exact_focus("antigravity", &FocusSteps { has_chain: true, ..FocusSteps::default() }));
        assert!(!is_exact_focus("claude", &FocusSteps { has_chain: true, ..FocusSteps::default() }));
        assert!(!is_exact_focus("codex", &FocusSteps { has_chain: true, ..FocusSteps::default() }));
        assert!(!is_exact_focus("ghostty", &FocusSteps { has_chain: true, mac_tab: Some(false), ..FocusSteps::default() }));
        assert!(is_exact_focus("ghostty", &FocusSteps { has_chain: true, mac_tab: Some(true), ..FocusSteps::default() }));
        assert!(is_exact_focus("alacritty", &FocusSteps { has_chain: true, tmux_selected: true, mac_tab: None, ..FocusSteps::default() }));
        assert!(!is_exact_focus("ghostty", &FocusSteps { has_chain: true, tmux_selected: true, mac_tab: Some(false), ..FocusSteps::default() }));
        assert!(is_exact_focus("orca", &FocusSteps { orca_switched: true, ..FocusSteps::default() }));
        assert!(is_exact_focus("wezterm", &FocusSteps { wezterm_selected: true, ..FocusSteps::default() }));
        assert!(is_exact_focus("windowsterminal", &FocusSteps { wt_selected: true, ..FocusSteps::default() }));
        assert!(is_exact_focus("cursor", &FocusSteps { editor_sent: true, ..FocusSteps::default() }));
        assert!(is_exact_focus("pwsh", &FocusSteps { has_chain: true, ..FocusSteps::default() }));
        assert!(!is_exact_focus("pwsh", &FocusSteps::default()));
    }
}
