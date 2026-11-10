//! The theme market (C26): themes.json in TixXin/focusd-plugins, built from its themes/ folder.
//! A theme is data only (what the island looks like) and runs no code, so the file is not
//! signed; the island checks every value again (features/theme-market/model.ts) before showing
//! or applying one. Here only the shape is checked: a known format and plausible ids.
use serde::Deserialize;
use serde_json::Value;

use super::market::{client, download_unless_missing};

const THEMES_URL: &str = "https://raw.githubusercontent.com/TixXin/focusd-plugins/main/themes.json";
const THEMES_VERSION: u32 = 1;
const MAX_THEMES_BYTES: u64 = 512 * 1024;
const MAX_THEMES: usize = 500;

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

/// The themes in themes.json that have an id and an appearance object, up to MAX_THEMES.
fn parse_themes(text: &str) -> Result<Vec<Value>, String> {
    let file: ThemesFile = serde_json::from_str(text).map_err(|error| format!("themes.json is not valid: {error}"))?;
    if file.version != THEMES_VERSION {
        return Err(format!("themes.json has format {}; this FocuSD Island reads format {THEMES_VERSION}. Update FocuSD Island.", file.version));
    }
    Ok(file
        .themes
        .into_iter()
        .filter(|theme| theme.get("id").is_some_and(is_theme_id) && theme.get("appearance").is_some_and(Value::is_object))
        .take(MAX_THEMES)
        .collect())
}

/// The theme market's themes; empty while themes.json does not exist yet.
#[tauri::command]
pub async fn get_theme_market() -> Result<Vec<Value>, String> {
    let client = client()?;
    match download_unless_missing(&client, THEMES_URL, MAX_THEMES_BYTES).await? {
        Some(bytes) => parse_themes(&String::from_utf8_lossy(&bytes)),
        None => Ok(Vec::new()),
    }
}

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
