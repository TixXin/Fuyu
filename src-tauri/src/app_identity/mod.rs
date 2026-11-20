mod menu;

use std::sync::{Mutex, PoisonError};

use tauri::{AppHandle, Manager};

use crate::{macos, settings_window, tray::TrayLanguage};

static LANGUAGE: Mutex<TrayLanguage> = Mutex::new(TrayLanguage::Chinese);

fn language() -> TrayLanguage {
    *LANGUAGE.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn display_name(language: TrayLanguage, development: bool) -> &'static str {
    match (language, development) {
        (TrayLanguage::Chinese, false) => "浮屿",
        (TrayLanguage::Chinese, true) => "浮屿 开发版",
        (TrayLanguage::English, false) => "Fuyu",
        (TrayLanguage::English, true) => "Fuyu Dev",
    }
}

pub(crate) fn settings_title(language: TrayLanguage) -> &'static str {
    match language {
        TrayLanguage::Chinese => "浮屿 - 设置",
        TrayLanguage::English => "Fuyu - Settings",
    }
}

pub(crate) fn init(app: &AppHandle) {
    apply_menu(app, language());
    apply_display_name(app);
}

pub(crate) fn set_language(app: &AppHandle, next: TrayLanguage) {
    {
        let mut current = LANGUAGE.lock().unwrap_or_else(PoisonError::into_inner);
        if *current == next {
            return;
        }
        *current = next;
    }
    apply_menu(app, next);
    apply_display_name(app);
    apply_settings_title(app);
}

pub(crate) fn before_dock_icon(app: &AppHandle) {
    apply_display_name(app);
    apply_settings_title(app);
}

pub(crate) fn after_dock_icon(app: &AppHandle) {
    let name = display_name(language(), crate::dev_lane::lane().is_some());
    let shown = app.run_on_main_thread(move || {
        macos::app_icon::use_own_icon_outside_bundle();
        if let Err(error) = macos::display_name::set(name) {
            eprintln!("failed to rename the app in the Dock: {error}");
        }
    });
    if let Err(error) = shown {
        eprintln!("failed to update the Dock icon: {error}");
    }
}

fn apply_menu(app: &AppHandle, language: TrayLanguage) {
    let result = menu::build(app, language).and_then(|menu| app.set_menu(menu));
    if let Err(error) = result {
        eprintln!("failed to build the app menu: {error}");
    }
}

fn apply_display_name(app: &AppHandle) {
    let name = display_name(language(), crate::dev_lane::lane().is_some());
    let result = app.run_on_main_thread(move || {
        if let Err(error) = macos::display_name::set(name) {
            eprintln!("failed to rename the app in the Dock: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("failed to rename the app in the Dock: {error}");
    }
}

fn apply_settings_title(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(settings_window::WINDOW_LABEL) {
        let _ = window.set_title(settings_title(language()));
    }
}

#[cfg(test)]
mod tests {
    use super::{display_name, settings_title};
    use crate::tray::TrayLanguage;

    #[test]
    fn the_dock_name_follows_the_app_language() {
        assert_eq!(display_name(TrayLanguage::Chinese, false), "浮屿");
        assert_eq!(display_name(TrayLanguage::English, false), "Fuyu");
        assert_eq!(display_name(TrayLanguage::Chinese, true), "浮屿 开发版");
        assert_eq!(display_name(TrayLanguage::English, true), "Fuyu Dev");
        assert_eq!(settings_title(TrayLanguage::Chinese), "浮屿 - 设置");
    }
}
