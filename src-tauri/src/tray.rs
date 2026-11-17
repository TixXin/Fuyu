use std::sync::{Mutex, PoisonError};

use tauri::{
    menu::{ContextMenu, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Wry,
};

use crate::{island, settings_window};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TrayLanguage {
    Chinese,
    English,
}

impl TrayLanguage {
    pub(crate) fn from_locale(locale: &str) -> Self {
        if locale.to_ascii_lowercase().starts_with("en") {
            Self::English
        } else {
            Self::Chinese
        }
    }
}

pub(crate) fn labels(language: TrayLanguage, island_visible: bool) -> [&'static str; 3] {
    match (language, island_visible) {
        (TrayLanguage::Chinese, true) => ["隐藏岛屿", "设置", "退出"],
        (TrayLanguage::Chinese, false) => ["显示岛屿", "设置", "退出"],
        (TrayLanguage::English, true) => ["Hide Island", "Settings", "Quit"],
        (TrayLanguage::English, false) => ["Show Island", "Settings", "Quit"],
    }
}

pub(crate) fn tooltip(language: TrayLanguage, development: bool) -> &'static str {
    match (development, language) {
        (false, _) => "Fuyu",
        (true, TrayLanguage::Chinese) => "Fuyu 开发版",
        (true, TrayLanguage::English) => "Fuyu Dev",
    }
}

pub(crate) const TRAY_ID: &str = "main";

struct TrayMenu {
    menu: Menu<Wry>,
    toggle: MenuItem<Wry>,
    settings: MenuItem<Wry>,
    quit: MenuItem<Wry>,
    shown: Mutex<(TrayLanguage, bool)>,
}

pub(crate) fn island_visible(app: &AppHandle) -> bool {
    island::main_window(app)
        .and_then(|window| window.is_visible().map_err(|error| error.to_string()))
        .unwrap_or(true)
}

fn refresh(app: &AppHandle, language: Option<TrayLanguage>) {
    crate::tray_menu::push_state(app);
    let Some(menu) = app.try_state::<TrayMenu>() else { return };
    let visible = island_visible(app);
    let mut shown = menu.shown.lock().unwrap_or_else(PoisonError::into_inner);
    let next = (language.unwrap_or(shown.0), visible);
    if *shown == next {
        return;
    }
    let [toggle, settings, quit] = labels(next.0, next.1);
    let _ = menu.toggle.set_text(toggle);
    let _ = menu.settings.set_text(settings);
    let _ = menu.quit.set_text(quit);
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(tooltip(next.0, crate::dev_lane::lane().is_some())));
    }
    *shown = next;
}

pub(crate) fn refresh_now(app: &AppHandle) {
    refresh(app, None);
}

pub(crate) fn toggle_island(app: &AppHandle) {
    if island_visible(app) {
        island::hide_island(app);
    } else {
        let _ = island::show_island(app);
    }
    refresh(app, None);
}

pub(crate) fn toggle_island_from_card(app: &AppHandle) {
    if island_visible(app) {
        island::hide_island(app);
    } else {
        let _ = island::show_island_without_focus(app);
    }
    let handle = app.clone();
    if app.run_on_main_thread(move || refresh(&handle, None)).is_err() {
        refresh(app, None);
    }
}

pub(crate) fn pop_up_native_menu(app: &AppHandle) {
    let Some(menu) = app.try_state::<TrayMenu>() else { return };
    let Ok(window) = island::main_window(app) else { return };
    if let Err(error) = menu.menu.popup(window.as_ref().window()) {
        eprintln!("failed to show the tray menu: {error}");
    }
}

#[tauri::command]
pub fn set_tray_language(app: AppHandle, locale: String) {
    refresh(&app, Some(TrayLanguage::from_locale(&locale)));
}

pub(crate) fn build_tray(app: &App) -> tauri::Result<()> {
    let [toggle_text, settings_text, quit_text] = labels(TrayLanguage::Chinese, true);
    let toggle = MenuItem::with_id(app, "toggle", toggle_text, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", settings_text, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", quit_text, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &settings, &quit])?;
    app.manage(TrayMenu { menu, toggle, settings, quit, shown: Mutex::new((TrayLanguage::Chinese, true)) });

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(tooltip(TrayLanguage::Chinese, crate::dev_lane::lane().is_some()))
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_island(app),
            "settings" => {
                if let Err(error) = settings_window::open(app) {
                    eprintln!("failed to open settings window: {error}");
                }
            }
            "quit" => {
                settings_window::remember_bounds(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Enter { .. } | TrayIconEvent::Move { .. } => refresh(tray.app_handle(), None),
            TrayIconEvent::Click { button: MouseButton::Left | MouseButton::Right, button_state: MouseButtonState::Up, rect, .. } => {
                refresh(tray.app_handle(), None);
                crate::tray_menu::toggle(tray.app_handle(), Some(&rect));
            }
            _ => {}
        });

    #[cfg(target_os = "macos")]
    {
        tray = tray.icon(crate::tray_mark::image()).icon_as_template(true);
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    crate::tray_visibility::apply_saved(app.handle());
    Ok(())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::tray::set_tray_language,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::{labels, TrayLanguage};

    #[test]
    fn the_menu_follows_the_language_and_names_what_the_toggle_will_do() {
        assert_eq!(TrayLanguage::from_locale("en"), TrayLanguage::English);
        assert_eq!(TrayLanguage::from_locale("en-US"), TrayLanguage::English);
        assert_eq!(TrayLanguage::from_locale("zh-CN"), TrayLanguage::Chinese);
        assert_eq!(TrayLanguage::from_locale("ja"), TrayLanguage::Chinese);
        assert_eq!(labels(TrayLanguage::Chinese, false), ["显示岛屿", "设置", "退出"]);
        assert_eq!(labels(TrayLanguage::Chinese, true)[0], "隐藏岛屿");
        assert_eq!(labels(TrayLanguage::English, false), ["Show Island", "Settings", "Quit"]);
        assert_eq!(labels(TrayLanguage::English, true)[0], "Hide Island");
    }

    #[test]
    fn only_a_development_build_says_so_in_the_tooltip() {
        assert_eq!(super::tooltip(TrayLanguage::Chinese, false), "Fuyu");
        assert_eq!(super::tooltip(TrayLanguage::English, false), "Fuyu");
        assert_eq!(super::tooltip(TrayLanguage::Chinese, true), "Fuyu 开发版");
        assert_eq!(super::tooltip(TrayLanguage::English, true), "Fuyu Dev");
    }
}
