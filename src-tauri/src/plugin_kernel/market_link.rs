use std::{
    sync::{Mutex, PoisonError},
    thread,
    time::Duration,
};

use tauri::{AppHandle, Emitter, Manager};

pub(crate) const PLUGIN_MARKET_INSTALL_EVENT: &str = "plugin-market-install-requested";
const SCHEME: &str = "fuyu";
const MAX_LINK_LENGTH: usize = 512;
const MAX_PLUGIN_NAME_LENGTH: usize = 214;
const COLD_START_DELAY: Duration = Duration::from_millis(1500);
#[cfg(target_os = "macos")]
const COLD_START_WINDOW: Duration = Duration::from_secs(5);

static PENDING_INSTALL: Mutex<Option<String>> = Mutex::new(None);
#[cfg(target_os = "macos")]
static STARTED_AT: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

pub(crate) fn init() {
    #[cfg(target_os = "macos")]
    {
        let _ = STARTED_AT.get_or_init(std::time::Instant::now);
    }
    #[cfg(windows)]
    {
        if crate::dev_lane::lane().is_some() {
            return;
        }
        let Ok(exe) = std::env::current_exe() else {
            return;
        };
        let command = format!("\"{}\" \"%1\"", exe.display());
        if let Err(error) = crate::win32::url_protocol::register(SCHEME, "Fuyu Protocol", &command) {
            eprintln!("could not register {SCHEME}:// protocol: {error}");
        }
    }
}

fn is_valid_part(part: &str) -> bool {
    let mut chars = part.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
        return false;
    }
    if part == "." || part == ".." || part.contains("..") {
        return false;
    }
    chars.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || matches!(ch, '.' | '_' | '~' | '-'))
}

pub(crate) fn parse_market_install_link(link: &str) -> Option<String> {
    if link.len() > MAX_LINK_LENGTH || link.chars().any(|ch| ch.is_control() || ch.is_whitespace()) {
        return None;
    }
    let (scheme, rest) = link.split_once("://")?;
    if !scheme.eq_ignore_ascii_case(SCHEME) {
        return None;
    }
    let rest = rest.split(['?', '#']).next().unwrap_or(rest);
    let mut parts = rest.trim_end_matches('/').split('/');
    let (authority, action, raw_scope, name) = (parts.next()?, parts.next()?, parts.next()?, parts.next()?);
    if parts.next().is_some() || !authority.eq_ignore_ascii_case("market") || !action.eq_ignore_ascii_case("install") {
        return None;
    }
    let scope = raw_scope.strip_prefix('@').unwrap_or(raw_scope);
    if !is_valid_part(scope) || !is_valid_part(name) {
        return None;
    }
    let normalized = format!("@{scope}/{name}");
    (normalized.len() <= MAX_PLUGIN_NAME_LENGTH).then_some(normalized)
}

pub(crate) fn find_in_args<I, S>(args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter().find_map(|arg| parse_market_install_link(arg.as_ref()))
}

#[cfg(target_os = "macos")]
pub(crate) fn open_opened_urls(app: &AppHandle, urls: &[tauri::Url]) {
    if let Some(plugin) = urls.iter().find_map(|url| parse_market_install_link(url.as_str())) {
        let cold_start = STARTED_AT.get().is_some_and(|at| at.elapsed() < COLD_START_WINDOW);
        open(app, plugin, cold_start);
    }
}

pub(crate) fn open(app: &AppHandle, plugin_name: String, cold_start: bool) {
    *PENDING_INSTALL.lock().unwrap_or_else(PoisonError::into_inner) = Some(plugin_name);
    let app = app.clone();
    let spawned = thread::Builder::new().name("plugin-market-link".into()).spawn(move || {
        if cold_start {
            thread::sleep(COLD_START_DELAY);
        }
        let _ = crate::island::show_island(&app);
        let focus_script = r#"localStorage.setItem("fuyu-settings-focus", JSON.stringify({ section: "pluginMarket", requestedAt: Date.now() }))"#;
        if let Some(settings) = app.get_webview_window(crate::settings_window::WINDOW_LABEL) {
            let _ = settings.eval(focus_script);
        } else if let Ok(window) = crate::island::main_window(&app) {
            if let Err(error) = window.eval(focus_script) {
                eprintln!("failed to ask settings for the pluginMarket page: {error}");
            }
        }
        if let Err(error) = crate::settings_window::open(&app) {
            eprintln!("could not open settings window for market link: {error}");
            return;
        }
        let _ = app.emit_to(crate::settings_window::WINDOW_LABEL, PLUGIN_MARKET_INSTALL_EVENT, ());
    });
    if let Err(error) = spawned {
        eprintln!("could not open a market link: {error}");
    }
}

#[tauri::command]
pub(crate) fn take_pending_market_install() -> Option<String> {
    PENDING_INSTALL.lock().unwrap_or_else(PoisonError::into_inner).take()
}

#[cfg(test)]
mod tests {
    use super::{find_in_args, parse_market_install_link};

    #[test]
    fn parses_valid_market_install_links_with_or_without_at_sign() {
        assert_eq!(parse_market_install_link("fuyu://market/install/@fuyu/weather"), Some("@fuyu/weather".into()));
        assert_eq!(parse_market_install_link("fuyu://market/install/fuyu/weather/"), Some("@fuyu/weather".into()));
        assert_eq!(parse_market_install_link("FUYU://Market/Install/@alice/my-plugin_1.0?from=site#top"), Some("@alice/my-plugin_1.0".into()));
        assert_eq!(find_in_args(["--foo", "fuyu://market/install/@fuyu/pomodoro"]), Some("@fuyu/pomodoro".into()));
    }

    #[test]
    fn rejects_invalid_schemes_paths_lengths_and_characters() {
        let too_long_url = format!("fuyu://market/install/@fuyu/{}", "a".repeat(520));
        let too_long_name = format!("fuyu://market/install/@fuyu/{}", "a".repeat(220));
        for raw in [
            "focusd://market/install/@fuyu/weather",
            "https://market/install/@fuyu/weather",
            "fuyu:market/install/@fuyu/weather",
            "fuyu://plugin/@fuyu/weather/callback",
            "fuyu://market/uninstall/@fuyu/weather",
            "fuyu://market/install/weather",
            "fuyu://market/install/@fuyu/",
            "fuyu://market/install/@/weather",
            "fuyu://market/install/@@fuyu/weather",
            "fuyu://market/install/@fuyu/weather/extra",
            "fuyu://market/install/@Fuyu/weather",
            "fuyu://market/install/@fuyu/Weather",
            "fuyu://market/install/@../weather",
            "fuyu://market/install/@fuyu/a..b",
            "fuyu://market/install/@fuyu/a b",
            "fuyu://market/install/@fuyu/a\nb",
            "fuyu://market/install/@-bad/weather",
            &too_long_url,
            &too_long_name,
        ] {
            assert_eq!(parse_market_install_link(raw), None, "{raw}");
        }
    }
}
