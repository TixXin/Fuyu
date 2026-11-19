use std::time::Duration;

use serde::Deserialize;
use serde_json::Value;

use crate::system::download_mirrors;

const THEMES_URL: &str = "https://raw.githubusercontent.com/TixXin/fuyu-plugins/main/themes.json";
const THEMES_VERSION: u32 = 1;
const MAX_THEMES_BYTES: u64 = 512 * 1024;
const MAX_THEMES: usize = 500;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Deserialize)]
struct ThemesFile {
    version: u32,
    #[serde(default)]
    themes: Vec<Value>,
}

fn is_theme_id(value: &Value) -> bool {
    value.as_str().is_some_and(|id| {
        (3..=64).contains(&id.len()) && id.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'.' || byte == b'-')
    })
}

fn parse_themes(text: &str) -> Result<Vec<Value>, String> {
    let file: ThemesFile = serde_json::from_str(text).map_err(|error| format!("themes.json is not valid: {error}"))?;
    if file.version != THEMES_VERSION {
        return Err(format!("themes.json has format {}; this Fuyu reads format {THEMES_VERSION}. Update Fuyu.", file.version));
    }
    Ok(file
        .themes
        .into_iter()
        .filter(|theme| theme.get("id").is_some_and(is_theme_id) && theme.get("appearance").is_some_and(Value::is_object))
        .take(MAX_THEMES)
        .collect())
}

#[tauri::command]
pub async fn get_theme_market() -> Result<Vec<Value>, String> {
    let client = download_mirrors::client(concat!("Fuyu/", env!("CARGO_PKG_VERSION")), REQUEST_TIMEOUT)?;
    let downloaded = download_mirrors::first_success(THEMES_URL, |source| {
        let client = client.clone();
        async move { download_mirrors::fetch(&client, &source.url, MAX_THEMES_BYTES).await }
    })
    .await
    .map(|(bytes, _)| bytes)
    .map_err(|failed| format!("Could not download {THEMES_URL}: {}", failed.summary()))?;
    match downloaded {
        Some(bytes) => parse_themes(&String::from_utf8_lossy(&bytes)),
        None => Ok(Vec::new()),
    }
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::theme_market::get_theme_market,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_themes_with_an_id_and_an_appearance() {
        let themes = parse_themes(
            r##"{ "version": 1, "themes": [
                { "id": "focusd.black", "appearance": { "islandBackgroundColor": "#000000" } },
                { "id": "Bad Id", "appearance": {} },
                { "id": "focusd.none" },
                { "id": "focusd.list", "appearance": [] }
            ] }"##,
        )
        .unwrap();
        assert_eq!(themes.len(), 1);
        assert_eq!(themes[0]["id"], "focusd.black");
    }

    #[test]
    fn a_newer_format_is_an_error() {
        assert!(parse_themes(r#"{ "version": 2, "themes": [] }"#).is_err());
        assert!(parse_themes("nope").is_err());
    }
}
