#![cfg_attr(not(windows), allow(dead_code))]

use std::path::Path;

#[cfg(windows)]
use windows::Win32::Foundation::HWND;

#[cfg(windows)]
use super::title::only_tab_titled;
#[cfg(windows)]
use crate::win32;

const EDITORS: &[&str] = &[
    "visual studio code",
    "visual studio code - insiders",
    "code",
    "code - insiders",
    "cursor",
    "windsurf",
    "trae",
    "kiro",
    "vscodium",
];
const TERMINALS: &[&str] = &[
    "terminal",
    "iterm",
    "ghostty",
    "wezterm",
    "windowsterminal",
    "wezterm-gui",
    "alacritty",
    "warp",
    "tabby",
    "conemu64",
    "mintty",
    "powershell",
    "pwsh",
    "cmd",
];
const CODEX_APPS: &[&str] = &["codex"];

const WINDOW_TITLE_UNITS: usize = 512;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct WindowCandidate {
    pub(super) title: String,
    pub(super) app: String,
}

#[derive(Debug, Default)]
pub(super) struct SessionHints<'a> {
    pub(super) folder: Option<&'a str>,
    pub(super) ancestors: &'a [String],
    pub(super) title: Option<&'a str>,
    pub(super) is_codex: bool,
}

pub(super) fn best_window(candidates: &[WindowCandidate], hints: &SessionHints) -> Option<usize> {
    let folder = hints
        .folder
        .map(str::to_lowercase)
        .filter(|folder| !folder.is_empty());
    let title = hints
        .title
        .map(|title| title.trim_end_matches('…').trim().to_lowercase())
        .filter(|title| title.chars().count() >= 2);

    let score = |candidate: &WindowCandidate| {
        let window_title = candidate.title.to_lowercase();
        let is_editor = EDITORS.contains(&candidate.app.as_str());
        let is_terminal = TERMINALS.contains(&candidate.app.as_str());
        let has_title = title
            .as_ref()
            .is_some_and(|title| window_title.contains(title));
        let has_folder = |matches: fn(&str, &str) -> bool| {
            folder
                .as_ref()
                .is_some_and(|folder| matches(&window_title, folder))
        };
        let has_ancestor = || {
            hints
                .ancestors
                .iter()
                .any(|ancestor| segment_names_folder(&window_title, &ancestor.to_lowercase()))
        };
        match () {
            _ if (is_editor || is_terminal) && has_title => 4,
            _ if is_editor && has_folder(segment_names_folder) => 3,
            _ if is_terminal && has_folder(path_names_folder) => 2,
            _ if is_editor && has_ancestor() => 2,
            _ if hints.is_codex && CODEX_APPS.contains(&candidate.app.as_str()) => 1,
            _ => 0,
        }
    };

    let mut best: Option<(usize, u8)> = None;
    for (index, candidate) in candidates.iter().enumerate() {
        let candidate_score = score(candidate);
        if candidate_score > best.map_or(0, |(_, score)| score) {
            best = Some((index, candidate_score));
        }
    }
    best.map(|(index, _)| index)
}

pub(super) fn bare_segment(segment: &str) -> &str {
    let mut text = segment.trim().trim_start_matches(['●', '•', '*']).trim();
    let remote = text.rsplit_once(" [").filter(|(_, label)| label.ends_with(']') && label.contains(": "));
    if let Some((name, _)) = remote {
        text = name.trim();
    }
    for marker in [" (workspace)", " (工作区)", " [administrator]", " [管理员]"] {
        text = text.strip_suffix(marker).unwrap_or(text).trim();
    }
    text
}

fn segment_names_folder(window_title: &str, folder: &str) -> bool {
    window_title
        .split(" - ")
        .flat_map(|segment| segment.split(" — "))
        .any(|segment| bare_segment(segment) == folder)
}

fn path_names_folder(window_title: &str, folder: &str) -> bool {
    window_title
        .split([' ', '\\', '/'])
        .any(|part| part.trim_matches([':', '>', '-', '—']) == folder)
        || segment_names_folder(window_title, folder)
}

#[cfg(target_os = "macos")]
pub(super) fn app_name(image_path: &str) -> String {
    match crate::macos::apps::outer_app_name(image_path) {
        Some(bundle) => bundle.to_lowercase(),
        None => Path::new(image_path).file_stem().map(|stem| stem.to_string_lossy().to_lowercase()).unwrap_or_default(),
    }
}

#[cfg(not(target_os = "macos"))]
pub(super) fn app_name(image_path: &str) -> String {
    Path::new(image_path)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

pub(super) const NOT_SESSION_HOSTS: &[&str] = &["explorer", "sihost", "svchost", "services", "winlogon", "launchd", "finder", "dock", "loginwindow"];

pub(super) fn window_of_process_chain(
    candidates: &[WindowCandidate],
    owners: &[u32],
    chain: &[u32],
    hints: &SessionHints,
) -> Option<usize> {
    chain.iter().find_map(|pid| {
        let owned: Vec<usize> = (0..candidates.len())
            .filter(|&index| owners.get(index) == Some(pid))
            .filter(|&index| !NOT_SESSION_HOSTS.contains(&candidates[index].app.as_str()))
            .collect();
        let first = *owned.first()?;
        let subset: Vec<WindowCandidate> = owned.iter().map(|&index| candidates[index].clone()).collect();
        Some(best_window(&subset, hints).map_or(first, |index| owned[index]))
    })
}

#[cfg(target_os = "macos")]
pub(super) fn open_app_exe(app: &str) -> Option<String> {
    crate::macos::apps::regular_apps().into_iter().map(|(_, path)| path).find(|path| app_name(path) == app)
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct FocusedWindow {
    pub(super) process_id: u32,
    pub(super) app: String,
    pub(super) in_front: bool,
}

#[cfg(target_os = "macos")]
pub(super) fn focus_session_window(
    hints: &SessionHints,
    chain: &[u32],
    prefer_app: Option<&str>,
) -> Option<FocusedWindow> {
    use crate::macos::apps;
    let apps_running = apps::regular_apps();
    let owner = chain
        .iter()
        .find_map(|pid| apps_running.iter().find(|(owner, path)| owner == pid && !NOT_SESSION_HOSTS.contains(&app_name(path).as_str())))
        .or_else(|| prefer_app.and_then(|wanted| apps_running.iter().find(|(_, path)| app_name(path) == wanted)))
        .or_else(|| {
            let candidates: Vec<WindowCandidate> = apps_running.iter().map(|(_, path)| WindowCandidate { title: String::new(), app: app_name(path) }).collect();
            best_window(&candidates, hints).and_then(|index| apps_running.get(index))
        })?;
    let (process_id, path) = owner.clone();
    let in_front = i32::try_from(process_id).is_ok_and(apps::activate);
    Some(FocusedWindow { process_id, app: app_name(&path), in_front })
}

#[cfg(target_os = "macos")]
pub(super) fn select_mac_terminal_tab(focused: &FocusedWindow, chain: &[u32]) -> Option<bool> {
    if !matches!(focused.app.as_str(), "terminal" | "iterm") {
        return None;
    }
    let tty = chain.iter().find_map(|pid| crate::macos::proc_info::tty_path(*pid))?;
    Some(crate::macos::terminal_tabs::select(&focused.app, &tty))
}

#[cfg(target_os = "macos")]
pub(super) fn select_terminal_tab(_focused: &FocusedWindow, _title: &str) -> bool {
    false
}

#[cfg(windows)]
pub(super) fn open_app_exe(app: &str) -> Option<String> {
    let mut found = None;
    let _ = win32::window::for_each_top_level_window(|window| {
        if found.is_some() || !win32::window::is_visible(window) || win32::window::has_owner(window) {
            return;
        }
        let process_id = win32::process::window_process_id(window);
        if let Some(path) = win32::process::image_path(process_id).filter(|path| app_name(path) == app) {
            found = Some(path);
        }
    });
    found
}

#[cfg(windows)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct FocusedWindow {
    pub(super) window: HWND,
    pub(super) process_id: u32,
    pub(super) app: String,
    pub(super) in_front: bool,
}

#[cfg(windows)]
pub(super) fn focus_session_window(
    hints: &SessionHints,
    chain: &[u32],
    prefer_app: Option<&str>,
) -> Option<FocusedWindow> {
    let mut windows = Vec::new();
    let mut candidates = Vec::new();
    let enumerated = win32::window::for_each_top_level_window(|window| {
        if !win32::window::is_visible(window) || win32::window::has_owner(window) {
            return;
        }
        let title = win32::window::window_text(window, WINDOW_TITLE_UNITS);
        if title.is_empty() {
            return;
        }
        let process_id = win32::process::window_process_id(window);
        let Some(path) = win32::process::image_path(process_id) else {
            return;
        };
        windows.push((window, process_id));
        candidates.push(WindowCandidate {
            title,
            app: app_name(&path),
        });
    });
    if enumerated.is_err() {
        return None;
    }

    let owners: Vec<u32> = windows.iter().map(|&(_, process_id)| process_id).collect();
    let index = window_of_process_chain(&candidates, &owners, chain, hints)
        .or_else(|| {
            let app = prefer_app?;
            let preferred: Vec<usize> = (0..candidates.len()).filter(|&i| candidates[i].app == app).collect();
            let subset: Vec<WindowCandidate> = preferred.iter().map(|&i| candidates[i].clone()).collect();
            best_window(&subset, hints).map(|i| preferred[i]).or_else(|| preferred.first().copied())
        })
        .or_else(|| best_window(&candidates, hints))?;
    let &(window, process_id) = windows.get(index)?;
    win32::window::allow_set_foreground_window(process_id);
    let in_front = win32::window::force_foreground(window);
    if !in_front {
        win32::window::flash(window);
    }
    Some(FocusedWindow {
        window,
        process_id,
        app: candidates[index].app.clone(),
        in_front,
    })
}

#[cfg(windows)]
pub(super) fn select_terminal_tab(focused: &FocusedWindow, title: &str) -> bool {
    let choose = |tabs: &[String]| only_tab_titled(tabs, title);
    if win32::uia_tabs::select_tab(focused.window, choose) {
        return true;
    }
    let mut others = Vec::new();
    let _ = win32::window::for_each_top_level_window(|window| {
        if window != focused.window
            && win32::window::is_visible(window)
            && !win32::window::has_owner(window)
            && win32::process::window_process_id(window) == focused.process_id
        {
            others.push(window);
        }
    });
    let Some(window) = others.into_iter().find(|&window| win32::uia_tabs::select_tab(window, choose)) else {
        return false;
    };
    win32::window::allow_set_foreground_window(focused.process_id);
    if !win32::window::force_foreground(window) {
        win32::window::flash(window);
    }
    true
}
