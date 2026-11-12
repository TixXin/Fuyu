use std::{
    sync::{Mutex, PoisonError},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

use super::{manifest::is_valid_id, uri::SCHEMES};

pub(super) const MARKET_INSTALL_EVENT: &str = "plugin-market-install-requested";
const MAX_LINK_LENGTH: usize = 512;
const COLD_START_DELAY: Duration = Duration::from_millis(1500);

static PENDING: Mutex<Option<String>> = Mutex::new(None);

pub(super) fn parse(link: &str) -> Option<String> {
    if link.len() > MAX_LINK_LENGTH || link.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return None;
    }
    let (scheme, rest) = link.split_once("://")?;
    if !SCHEMES.iter().any(|known| scheme.eq_ignore_ascii_case(known)) {
        return None;
    }
    let rest = rest.split(['?', '#']).next().unwrap_or(rest);
    let mut parts = rest.trim_end_matches('/').split('/');
    let (authority, action, id) = (parts.next()?, parts.next()?, parts.next()?);
    if parts.next().is_some() || !authority.eq_ignore_ascii_case("market") || !action.eq_ignore_ascii_case("install") {
        return None;
    }
    is_valid_id(id).then(|| id.to_string())
}

pub(super) fn open(app: &AppHandle, id: String, cold_start: bool) {
    *PENDING.lock().unwrap_or_else(PoisonError::into_inner) = Some(id);
    let app = app.clone();
    let spawned = thread::Builder::new().name("market-link".into()).spawn(move || {
        if cold_start {
            thread::sleep(COLD_START_DELAY);
        }
        if let Err(error) = crate::settings_window::open(&app) {
            eprintln!("could not open the plugin market for a link: {error}");
            return;
        }
        let _ = app.emit_to(crate::settings_window::WINDOW_LABEL, MARKET_INSTALL_EVENT, ());
    });
    if let Err(error) = spawned {
        eprintln!("could not open a market link: {error}");
    }
}

#[tauri::command]
pub fn take_market_install_request() -> Option<String> {
    PENDING.lock().unwrap_or_else(PoisonError::into_inner).take()
}

#[cfg(test)]
mod tests {
    use super::parse;

    #[test]
    fn an_install_link_names_the_plugin() {
        assert_eq!(parse("fuyu://market/install/dev.focusd.pomodoro"), Some("dev.focusd.pomodoro".into()));
        assert_eq!(parse("focusd://market/install/dev.focusd.pomodoro/"), Some("dev.focusd.pomodoro".into()));
        assert_eq!(parse("FUYU://Market/Install/com.example.clock?from=site#top"), Some("com.example.clock".into()));
    }

    #[test]
    fn other_links_and_bad_ids_are_refused() {
        let long = format!("fuyu://market/install/{}", "a".repeat(600));
        for text in [
            "fuyu://plugin/dev.focusd.pomodoro",
            "fuyu://market/dev.focusd.pomodoro",
            "fuyu://market/install/",
            "fuyu://market/install/dev.focusd.pomodoro/extra",
            "fuyu://market/uninstall/dev.focusd.pomodoro",
            "fuyu://market/install/Dev.Pomodoro",
            "fuyu://market/install/../x",
            "fuyu://market/install/a..b.c",
            "fuyu://market/install/ab",
            "fuyu://market/install/a b",
            "https://market/install/dev.focusd.pomodoro",
            "fuyu:market/install/dev.focusd.pomodoro",
            &long,
        ] {
            assert_eq!(parse(text), None, "{text}");
        }
    }
}
