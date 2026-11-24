use std::{fs, path::Path};

use serde_json::Value;

use super::window_focus::FocusedWindow;

const SAVED_DIR: &str = "agent-antigravity";
const IDE_APPS: [&str; 2] = ["antigravity ide", "antigravity-ide"];
const DESKTOP_APP: &str = "antigravity";
pub(super) const APPS: [&str; 3] = [IDE_APPS[0], IDE_APPS[1], DESKTOP_APP];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Product {
    Ide,
    Desktop,
    Cli,
}

impl Product {
    pub(super) fn label(self) -> &'static str {
        match self {
            Product::Ide => "ide",
            Product::Desktop => "desktop",
            Product::Cli => "cli",
        }
    }
}

pub(super) fn is_desktop_app(app: &str) -> bool {
    app == DESKTOP_APP
}

pub(super) fn conversation_url_matches(url_or_path: &str, session_id: &str) -> bool {
    if session_id.is_empty() || session_id.contains(['/', '?', '#']) {
        return false;
    }
    let without_fragment = url_or_path.split('#').next().unwrap_or(url_or_path);
    let without_query = without_fragment.split('?').next().unwrap_or(without_fragment);
    let path = match without_query.split_once("://") {
        Some((_, rest)) => rest.find('/').map_or("", |index| &rest[index..]),
        None => without_query,
    };
    match path.strip_prefix("/c/").and_then(|rest| rest.strip_prefix(session_id)) {
        Some("") => true,
        Some(rest) => rest.starts_with('/'),
        None => false,
    }
}

pub(super) fn product_of_transcript(path: &str) -> Option<Product> {
    let parts: Vec<String> = path.split(['\\', '/']).map(str::to_ascii_lowercase).collect();
    parts.windows(2).find_map(|pair| match (pair[0].as_str(), pair[1].as_str()) {
        (".gemini", "antigravity-ide") => Some(Product::Ide),
        (".gemini", "antigravity") => Some(Product::Desktop),
        (".gemini", "antigravity-cli") => Some(Product::Cli),
        _ => None,
    })
}

pub(super) fn apps_for(product: Option<Product>) -> Vec<String> {
    let order: &[&str] = match product {
        Some(Product::Cli) => &[],
        Some(Product::Desktop) => &[DESKTOP_APP, IDE_APPS[0], IDE_APPS[1]],
        Some(Product::Ide) | None => &APPS,
    };
    order.iter().map(|app| app.to_string()).collect()
}

pub(super) fn transcript_of(input: &Value, session_id: &str) -> Option<Option<String>> {
    (input["conversationId"].as_str() == Some(session_id)).then(|| input["transcriptPath"].as_str().map(str::to_string))
}

pub(super) fn session_product(app_dir: &Path, session_id: &str) -> Option<Product> {
    let mut newest: Option<(std::time::SystemTime, Option<String>)> = None;
    for entry in fs::read_dir(app_dir.join(SAVED_DIR)).into_iter().flatten().flatten() {
        let Some(modified) = entry.metadata().ok().and_then(|meta| meta.modified().ok()) else {
            continue;
        };
        if newest.as_ref().is_some_and(|(at, _)| *at >= modified) {
            continue;
        }
        let input = fs::read_to_string(entry.path())
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}').trim()).ok());
        if let Some(transcript) = input.as_ref().and_then(|input| transcript_of(input, session_id)) {
            newest = Some((modified, transcript));
        }
    }
    newest.and_then(|(_, transcript)| transcript).as_deref().and_then(product_of_transcript)
}

#[cfg(target_os = "macos")]
pub(super) fn select_session(focused: &FocusedWindow, session_id: &str, folder: Option<&str>) -> bool {
    use std::time::Duration;
    use crate::macos::{accessibility::{self, Element}, apps};

    const AX_TIMEOUT_SECONDS: f32 = 0.25;
    const POLL_INTERVAL: Duration = Duration::from_millis(50);
    const POLL_ATTEMPTS: usize = 5;
    const WEB_AREA_NODE_LIMIT: usize = 128;
    const NAV_NODE_LIMIT: usize = 600;
    const MAX_DEPTH: usize = 20;

    fn find_web_area(element: &Element, depth: usize, budget: &mut usize) -> Option<Element> {
        if depth > MAX_DEPTH || *budget == 0 {
            return None;
        }
        *budget -= 1;
        if element.text("AXRole").as_deref() == Some("AXWebArea")
            && element.url_path("AXURL").is_some_and(|path| path.starts_with('/'))
        {
            return Some(element.clone());
        }
        for child in element.children() {
            if let Some(found) = find_web_area(&child, depth + 1, budget) {
                return Some(found);
            }
        }
        None
    }

    fn find_sidebar(element: &Element, depth: usize, budget: &mut usize) -> Option<Element> {
        if depth > MAX_DEPTH || *budget == 0 {
            return None;
        }
        *budget -= 1;
        let subrole = element.text("AXSubrole");
        if subrole.as_deref() == Some("AXLandmarkNavigation") {
            return Some(element.clone());
        }
        if subrole.as_deref() == Some("AXLandmarkMain") {
            return None;
        }
        for child in element.children() {
            if let Some(found) = find_sidebar(&child, depth + 1, budget) {
                return Some(found);
            }
        }
        None
    }

    fn find_toggle_sidebar_button(element: &Element, depth: usize, budget: &mut usize) -> Option<Element> {
        if depth > MAX_DEPTH || *budget == 0 {
            return None;
        }
        *budget -= 1;
        let subrole = element.text("AXSubrole");
        if subrole.as_deref() == Some("AXLandmarkMain") {
            return None;
        }
        if element.text("AXRole").as_deref() == Some("AXButton")
            && element.text("AXDescription").as_deref() == Some("Toggle Sidebar")
            && element.boolean("AXExpanded") == Some(false)
        {
            return Some(element.clone());
        }
        for child in element.children() {
            if let Some(found) = find_toggle_sidebar_button(&child, depth + 1, budget) {
                return Some(found);
            }
        }
        None
    }

    fn find_conversation_link(element: &Element, session_id: &str, depth: usize, budget: &mut usize) -> Option<Element> {
        if depth > MAX_DEPTH || *budget == 0 {
            return None;
        }
        *budget -= 1;
        if element.text("AXRole").as_deref() == Some("AXLink")
            && element
                .url_path("AXURL")
                .is_some_and(|path| conversation_url_matches(&path, session_id))
        {
            return Some(element.clone());
        }
        for child in element.children() {
            if let Some(found) = find_conversation_link(&child, session_id, depth + 1, budget) {
                return Some(found);
            }
        }
        None
    }

    fn find_collapsed_button(element: &Element, target_title: &str, depth: usize, budget: &mut usize) -> Option<Element> {
        if depth > MAX_DEPTH || *budget == 0 {
            return None;
        }
        *budget -= 1;
        if element.text("AXRole").as_deref() == Some("AXButton")
            && element.boolean("AXExpanded") == Some(false)
            && element
                .text("AXTitle")
                .is_some_and(|title| title.eq_ignore_ascii_case(target_title))
        {
            return Some(element.clone());
        }
        for child in element.children() {
            if let Some(found) = find_collapsed_button(&child, target_title, depth + 1, budget) {
                return Some(found);
            }
        }
        None
    }

    fn collect_web_areas(app: &Element) -> Vec<(Element, Element)> {
        app.windows()
            .into_iter()
            .filter_map(|window| {
                let mut budget = WEB_AREA_NODE_LIMIT;
                let web = find_web_area(&window, 0, &mut budget)?;
                Some((window, web))
            })
            .collect()
    }

    if !accessibility::is_trusted() {
        return false;
    }
    let Ok(pid) = i32::try_from(focused.process_id) else {
        return false;
    };
    let Some(app) = Element::application_with_timeout(pid, AX_TIMEOUT_SECONDS) else {
        return false;
    };
    let _ = app.set_boolean("AXManualAccessibility", true);

    let mut pairs = collect_web_areas(&app);
    for _ in 0..POLL_ATTEMPTS {
        if !pairs.is_empty() {
            break;
        }
        std::thread::sleep(POLL_INTERVAL);
        pairs = collect_web_areas(&app);
    }
    if pairs.is_empty() {
        return false;
    }

    for (window, web) in &pairs {
        if web.url_path("AXURL").is_some_and(|path| conversation_url_matches(&path, session_id)) {
            let _ = window.raise_window();
            let _ = apps::activate_main_window(pid);
            let _ = window.perform("AXRaise");
            return true;
        }
    }

    let (_, web) = &pairs[0];
    let mut budget = WEB_AREA_NODE_LIMIT;
    let nav = match find_sidebar(web, 0, &mut budget) {
        Some(nav) => nav,
        None => {
            let mut button_budget = WEB_AREA_NODE_LIMIT;
            if let Some(toggle) = find_toggle_sidebar_button(web, 0, &mut button_budget) {
                let _ = toggle.perform("AXPress");
                let mut found = None;
                for _ in 0..POLL_ATTEMPTS {
                    std::thread::sleep(POLL_INTERVAL);
                    let mut retry_budget = WEB_AREA_NODE_LIMIT;
                    if let Some(nav) = find_sidebar(web, 0, &mut retry_budget) {
                        found = Some(nav);
                        break;
                    }
                }
                match found {
                    Some(nav) => nav,
                    None => return false,
                }
            } else {
                return false;
            }
        }
    };

    let mut link_budget = NAV_NODE_LIMIT;
    if let Some(link) = find_conversation_link(&nav, session_id, 0, &mut link_budget) {
        return link.perform("AXPress");
    }

    let mut expanded = false;
    let mut projects_budget = NAV_NODE_LIMIT;
    if let Some(projects) = find_collapsed_button(&nav, "Projects", 0, &mut projects_budget) {
        if projects.perform("AXPress") {
            expanded = true;
            std::thread::sleep(POLL_INTERVAL);
        }
    }
    if let Some(folder_name) = folder {
        let mut folder_budget = NAV_NODE_LIMIT;
        if let Some(project) = find_collapsed_button(&nav, folder_name, 0, &mut folder_budget) {
            if project.perform("AXPress") {
                expanded = true;
            }
        }
    }
    if !expanded {
        return false;
    }

    for _ in 0..POLL_ATTEMPTS {
        std::thread::sleep(POLL_INTERVAL);
        let mut retry_budget = NAV_NODE_LIMIT;
        if let Some(link) = find_conversation_link(&nav, session_id, 0, &mut retry_budget) {
            return link.perform("AXPress");
        }
    }
    false
}

#[cfg(windows)]
pub(super) fn select_session(focused: &FocusedWindow, session_id: &str, folder: Option<&str>) -> bool {
    use crate::win32;

    let matches = |url: &str| conversation_url_matches(url, session_id);
    if win32::uia_links::document_matches(focused.window, matches) {
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
    if let Some(window) = others
        .into_iter()
        .find(|&window| win32::uia_links::document_matches(window, matches))
    {
        win32::window::allow_set_foreground_window(focused.process_id);
        if !win32::window::force_foreground(window) {
            win32::window::flash(window);
        }
        return true;
    }
    win32::uia_links::activate_link(focused.window, matches, folder)
}

#[cfg(not(any(target_os = "macos", windows)))]
pub(super) fn select_session(_focused: &FocusedWindow, _session_id: &str, _folder: Option<&str>) -> bool {
    false
}

#[cfg(test)]
#[path = "antigravity_focus_tests.rs"]
mod tests;
