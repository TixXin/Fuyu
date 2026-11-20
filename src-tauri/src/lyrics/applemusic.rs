use std::sync::{Mutex, PoisonError};

use serde_json::Value;

use super::found::{browser_client, FoundLyrics};
use super::matching::same_track;
use super::ttml;
use crate::plugin_kernel::plugin_windows::encode_query_component as encode;

const BROWSE_URL: &str = "https://music.apple.com/us/browse";
const API_BASE: &str = "https://amp-api.music.apple.com/v1";
const DEFAULT_STOREFRONT: &str = "cn";
const DEFAULT_LANGUAGE: &str = "zh-Hans-CN";
const PLAYER_NEEDLES: &[&str] = &["applemusic", "apple.music", "com.apple.music"];

static DEVELOPER_TOKEN: Mutex<Option<String>> = Mutex::new(None);

pub(super) fn is_apple_music(source_app: Option<&str>) -> bool {
    let Some(app) = source_app.map(str::to_lowercase) else {
        return false;
    };
    PLAYER_NEEDLES.iter().any(|needle| app.contains(needle))
}

fn find_script_url(html: &str) -> Option<String> {
    let mut from = 0;
    while let Some(found) = html[from..].find("assets/index") {
        let start = from + found;
        let rest = &html[start..];
        let end = rest.find(".js")?;
        let path = &rest[..end + 3];
        if !path.contains(['"', '\'', ' ', '<']) {
            return Some(format!("https://music.apple.com/{path}"));
        }
        from = start + 1;
    }
    None
}

fn find_jwt(text: &str) -> Option<String> {
    let is_jwt_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.');
    let mut from = 0;
    while let Some(found) = text[from..].find("eyJ") {
        let start = from + found;
        let rest = &text[start..];
        let candidate = &rest[..rest.find(|c| !is_jwt_char(c)).unwrap_or(rest.len())];
        let parts: Vec<&str> = candidate.split('.').collect();
        if parts.len() == 3 && parts.iter().all(|part| !part.is_empty()) {
            return Some(candidate.to_string());
        }
        from = start + 3;
    }
    None
}

fn cached_developer_token() -> Option<String> {
    DEVELOPER_TOKEN.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

fn keep_developer_token(token: Option<String>) {
    *DEVELOPER_TOKEN.lock().unwrap_or_else(PoisonError::into_inner) = token;
}

async fn developer_token(client: &reqwest::Client) -> Result<String, String> {
    if let Some(token) = cached_developer_token() {
        return Ok(token);
    }
    let html = get_text(client, BROWSE_URL).await?;
    let script = find_script_url(&html).ok_or("Apple Music's page has no script address.")?;
    let token = find_jwt(&get_text(client, &script).await?).ok_or("Apple Music's script has no developer token.")?;
    keep_developer_token(Some(token.clone()));
    Ok(token)
}

fn storefront_of(answer: Option<&Value>) -> (String, String) {
    let attributes = answer.map(|answer| &answer["data"][0]["attributes"]);
    match attributes.and_then(|attributes| Some((attributes["storefront"].as_str()?, attributes))) {
        Some((id, attributes)) => (id.to_string(), attributes["defaultLanguageTag"].as_str().unwrap_or(DEFAULT_LANGUAGE).to_string()),
        None => (DEFAULT_STOREFRONT.to_string(), DEFAULT_LANGUAGE.to_string()),
    }
}

fn search_url(storefront: &str, language: &str, term: &str) -> String {
    format!("{API_BASE}/catalog/{storefront}/search?term={}&types=songs&limit=20&l={}", encode(term), encode(language))
}

fn lyrics_urls(storefront: &str, language: &str, id: &str) -> [String; 3] {
    let song = format!("{API_BASE}/catalog/{storefront}/songs/{id}");
    let language = encode(language);
    [
        format!("{song}/syllable-lyrics?l={language}&extend=ttmlLocalizations"),
        format!("{song}?include[songs]=lyrics,syllable-lyrics&l={language}"),
        format!("{song}/lyrics?l={language}"),
    ]
}

fn best_song(answer: &Value, title: &str, artist: &str, duration_ms: i64) -> Option<String> {
    let candidates: Vec<(String, i64, bool)> = answer["results"]["songs"]["data"]
        .as_array()?
        .iter()
        .filter_map(|song| {
            let attributes = &song["attributes"];
            let length = attributes["durationInMillis"].as_i64().unwrap_or(0);
            let found = (attributes["name"].as_str()?, attributes["artistName"].as_str()?, length);
            let has_lyrics = attributes["hasLyrics"].as_bool().unwrap_or(true);
            let id = song["id"].as_str()?.to_string();
            same_track((title, artist, duration_ms), found).then_some((id, length, has_lyrics))
        })
        .collect();
    let any_lyrics = candidates.iter().any(|(_, _, has_lyrics)| *has_lyrics);
    candidates
        .into_iter()
        .filter(|(_, _, has_lyrics)| *has_lyrics || !any_lyrics)
        .enumerate()
        .min_by_key(|(index, (_, length, _))| if duration_ms > 0 { (duration_ms - length).abs() } else { *index as i64 })
        .map(|(_, (id, _, _))| id)
}

fn ttml_text(attributes: &Value) -> Option<String> {
    let non_empty = |value: &Value| value.as_str().filter(|text| !text.is_empty()).map(str::to_string);
    let localizations = &attributes["ttmlLocalizations"];
    non_empty(&attributes["ttml"])
        .or_else(|| non_empty(localizations))
        .or_else(|| localizations.as_object()?.values().find_map(|value| non_empty(&value["ttml"])))
}

fn ttml_of(answer: &Value) -> Option<String> {
    let data = &answer["data"][0];
    ttml_text(&data["attributes"])
        .or_else(|| ["syllable-lyrics", "lyrics"].iter().find_map(|name| ttml_text(&data["relationships"][name]["data"][0]["attributes"])))
}

fn lyrics_of(answer: &Value) -> Option<FoundLyrics> {
    ttml::to_lyrics(&ttml_of(answer)?)
}

pub(super) async fn fetch(title: &str, artist: &str, duration_ms: i64, token: &str) -> Result<Option<FoundLyrics>, String> {
    let client = browser_client()?;
    let developer = developer_token(&client).await?;
    let me = get_json(&client, &format!("{API_BASE}/me/storefront"), &developer, Some(token)).await;
    if matches!(&me, Err(error) if error.contains("401")) {
        keep_developer_token(None);
    }
    let (storefront, language) = storefront_of(me.ok().flatten().as_ref());
    let term = format!("{title} {artist}");
    let Some(search) = get_json(&client, &search_url(&storefront, &language, term.trim()), &developer, None).await? else {
        return Ok(None);
    };
    let Some(id) = best_song(&search, title, artist, duration_ms) else {
        return Ok(None);
    };
    let mut answers = Vec::new();
    for url in lyrics_urls(&storefront, &language, &id) {
        let answer = get_json(&client, &url, &developer, Some(token)).await;
        let found = matches!(&answer, Ok(Some(body)) if lyrics_of(body).is_some());
        answers.push(answer);
        if found {
            break;
        }
    }
    first_lyrics(answers)
}

fn first_lyrics(answers: Vec<Result<Option<Value>, String>>) -> Result<Option<FoundLyrics>, String> {
    let mut failure = None;
    let mut reached = false;
    for answer in answers {
        match answer {
            Ok(Some(body)) => {
                reached = true;
                if let Some(found) = lyrics_of(&body) {
                    return Ok(Some(found));
                }
            }
            Ok(None) => reached = true,
            Err(error) => failure = Some(error),
        }
    }
    match failure {
        Some(error) if !reached => Err(error),
        _ => Ok(None),
    }
}

async fn get_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client.get(url).send().await.map_err(|error| format!("Could not reach Apple Music: {}", error.without_url()))?;
    if !response.status().is_success() {
        return Err(format!("Apple Music answered {}", response.status()));
    }
    response.text().await.map_err(|error| format!("Apple Music sent something unexpected: {}", error.without_url()))
}

async fn get_json(client: &reqwest::Client, url: &str, developer: &str, user: Option<&str>) -> Result<Option<Value>, String> {
    let mut request = client.get(url).header("Origin", "https://music.apple.com").header("Accept", "application/json").bearer_auth(developer);
    if let Some(token) = user {
        request = request.header("media-user-token", token).header("Cookie", format!("media-user-token={token}"));
    }
    let response = request.send().await.map_err(|error| format!("Could not reach Apple Music: {}", error.without_url()))?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!("Apple Music answered {}", response.status()));
    }
    response.json().await.map(Some).map_err(|error| format!("Apple Music sent something unexpected: {}", error.without_url()))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    const TTML: &str = r#"<tt><body><div><p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:02.000">你好</span><span begin="00:02.000" end="00:03.000">世界啊朋友们</span><span ttm:role="x-translation">Hello world</span></p></div></body></tt>"#;

    fn song(id: &str, name: &str, artist: &str, ms: i64, has_lyrics: Option<bool>) -> Value {
        let mut attributes = json!({ "name": name, "artistName": artist, "durationInMillis": ms });
        if let Some(has) = has_lyrics {
            attributes["hasLyrics"] = json!(has);
        }
        json!({ "id": id, "attributes": attributes })
    }

    #[test]
    fn only_apple_music_players_count() {
        assert!(is_apple_music(Some("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App")));
        assert!(is_apple_music(Some("com.apple.Music")));
        assert!(!is_apple_music(Some("cloudmusic.exe")));
        assert!(!is_apple_music(None));
    }

    #[test]
    fn the_same_song_with_lyrics_and_the_closest_length_is_picked() {
        let results = |songs: Vec<Value>| json!({ "results": { "songs": { "data": songs } } });
        let found = results(vec![
            song("1", "晴天", "周杰伦", 269_000, Some(false)),
            song("2", "晴天", "周杰伦", 271_000, Some(true)),
            song("3", "晴天", "周杰伦", 270_000, None),
            song("4", "七里香", "周杰伦", 269_000, Some(true)),
        ]);
        assert_eq!(best_song(&found, "晴天", "周杰伦", 269_500).as_deref(), Some("3"));
        let instrumental = results(vec![song("5", "晴天", "周杰伦", 269_000, Some(false))]);
        assert_eq!(best_song(&instrumental, "晴天", "周杰伦", 269_000).as_deref(), Some("5"));
        assert_eq!(best_song(&results(vec![song("6", "稻香", "周杰伦", 1, None)]), "晴天", "周杰伦", 0), None);
        assert_eq!(best_song(&json!({}), "晴天", "周杰伦", 0), None);
    }

    #[test]
    fn the_three_lyrics_addresses_are_tried_in_order_and_404_is_no_lyrics() {
        let [syllable, include, plain] = lyrics_urls("cn", "zh-Hans-CN", "42");
        assert_eq!(syllable, "https://amp-api.music.apple.com/v1/catalog/cn/songs/42/syllable-lyrics?l=zh-Hans-CN&extend=ttmlLocalizations");
        assert_eq!(include, "https://amp-api.music.apple.com/v1/catalog/cn/songs/42?include[songs]=lyrics,syllable-lyrics&l=zh-Hans-CN");
        assert_eq!(plain, "https://amp-api.music.apple.com/v1/catalog/cn/songs/42/lyrics?l=zh-Hans-CN");
        assert_eq!(
            search_url("cn", "zh-Hans-CN", "晴天 周杰伦"),
            "https://amp-api.music.apple.com/v1/catalog/cn/search?term=%E6%99%B4%E5%A4%A9%20%E5%91%A8%E6%9D%B0%E4%BC%A6&types=songs&limit=20&l=zh-Hans-CN"
        );
        let direct = json!({ "data": [{ "attributes": { "ttml": TTML } }] });
        let related = json!({ "data": [{ "attributes": {}, "relationships": { "lyrics": { "data": [{ "attributes": { "ttmlLocalizations": { "zh": { "ttml": TTML } } } }] } } }] });
        let found = first_lyrics(vec![Ok(None), Ok(Some(json!({ "data": [] }))), Ok(Some(related))]).unwrap().unwrap();
        assert_eq!(found.translation.as_deref(), Some("[00:01.00]Hello world\n"));
        assert!(found.lrc.starts_with("[00:01.00]<00:01.00>你好"));
        assert_eq!(first_lyrics(vec![Ok(Some(direct))]).unwrap(), Some(found));
        assert_eq!(first_lyrics(vec![Ok(None), Err("down".into())]), Ok(None));
        assert_eq!(first_lyrics(vec![Err("a".into()), Err("down".into())]), Err("down".into()));
    }

    #[test]
    fn the_developer_token_and_the_storefront_are_read_from_apple() {
        let html = r#"<script src="/assets/index"></script><script type="module" src="/assets/index~a1b2.js"></script>"#;
        assert_eq!(find_script_url(html).as_deref(), Some("https://music.apple.com/assets/index~a1b2.js"));
        assert_eq!(find_jwt(r#"x="eyJbad";y="eyJhbGc.eyJpc3M.sig-_1""#).as_deref(), Some("eyJhbGc.eyJpc3M.sig-_1"));
        let me = json!({ "data": [{ "attributes": { "storefront": "us", "defaultLanguageTag": "en-US" } }] });
        assert_eq!(storefront_of(Some(&me)), ("us".to_string(), "en-US".to_string()));
        assert_eq!(storefront_of(None), ("cn".to_string(), "zh-Hans-CN".to_string()));
    }
}
