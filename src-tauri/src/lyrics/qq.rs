use serde_json::{json, Value};

use super::found::{browser_client, from_lines, lrc_lines, FoundLyrics};
use super::matching::same_track;
use super::qrc;

const SEARCH: &str = "https://c.y.qq.com/soso/fcgi-bin/client_search_cp";
const MUSICU: &str = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const REFERER: &str = "https://y.qq.com/";

pub(super) fn best_song(search: &Value, title: &str, artist: &str, duration_ms: i64) -> Option<String> {
    search["data"]["song"]["list"]
        .as_array()?
        .iter()
        .filter_map(|song| {
            let singers: Vec<&str> = song["singer"].as_array()?.iter().filter_map(|singer| singer["name"].as_str()).collect();
            let length = song["interval"].as_i64().unwrap_or(0) * 1000;
            let mid = song["songmid"].as_str().filter(|mid| !mid.is_empty() && mid.bytes().all(|byte| byte.is_ascii_alphanumeric()))?;
            same_track((title, artist, duration_ms), (song["songname"].as_str()?, &singers.join(", "), length)).then(|| (mid.to_string(), length))
        })
        .enumerate()
        .min_by_key(|(index, (_, length))| if duration_ms > 0 { (duration_ms - length).abs() } else { *index as i64 })
        .map(|(_, (mid, _))| mid)
}

fn lyric_request(mid: &str) -> String {
    json!({
        "comm": { "ct": 24, "cv": 0, "format": "json" },
        "req": {
            "module": "music.musichallSong.PlayLyricInfo",
            "method": "GetPlayLyricInfo",
            "param": { "songMid": mid, "crypt": 1, "ct": 19, "cv": 2111, "qrc": 1, "trans": 1, "roma": 0, "lrc_t": 0, "qrc_t": 0, "trans_t": 0, "type": 0 },
        },
    })
    .to_string()
}

fn plain(text: &str) -> Option<String> {
    let text = text.trim();
    if text.is_empty() {
        None
    } else if text.starts_with('[') || text.starts_with('<') {
        Some(text.to_string())
    } else {
        qrc::decrypt(text)
    }
}

pub(super) fn lyrics_of(data: &Value, title: &str) -> Option<FoundLyrics> {
    let lyric = plain(data["lyric"].as_str()?)?;
    let words: Vec<(u64, String)> = qrc::lines(&lyric).iter().map(|line| (line.start_ms, line.timed_text())).collect();
    let lines = if words.iter().any(|(_, text)| text.contains('<')) { words } else { lrc_lines(&lyric) };
    let translated = lrc_lines(&data["trans"].as_str().and_then(plain).unwrap_or_default());
    let translations: Vec<String> = lines
        .iter()
        .map(|(ms, _)| translated.iter().find(|(at, _)| at.abs_diff(*ms) < 50).map(|(_, text)| text.clone()).unwrap_or_default())
        .map(|text| if text == "//" { String::new() } else { text })
        .collect();
    let has_translation = translations.iter().any(|line| !line.is_empty());
    from_lines(&lines, has_translation.then_some(translations.as_slice()), title)
}

async fn get_json(client: &reqwest::Client, url: &str, query: &[(&str, String)]) -> Result<Value, String> {
    let url = reqwest::Url::parse_with_params(url, query).map_err(|error| error.to_string())?;
    let response = client.get(url).header("Referer", REFERER).send().await.map_err(|error| format!("Could not reach QQ Music: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("QQ Music answered {}", response.status()));
    }
    response.json().await.map_err(|error| format!("QQ Music sent something unexpected: {error}"))
}

pub(super) async fn fetch(title: &str, artist: &str, duration_ms: i64) -> Result<Option<FoundLyrics>, String> {
    let client = browser_client()?;
    let keyword = format!("{title} {artist}").trim().to_string();
    let search = get_json(&client, SEARCH, &[("w", keyword), ("format", "json".into()), ("p", "1".into()), ("n", "20".into())]).await?;
    let Some(mid) = best_song(&search, title, artist, duration_ms) else {
        return Ok(None);
    };
    let answer = get_json(&client, MUSICU, &[("data", lyric_request(&mid))]).await?;
    if answer["req"]["code"].as_i64() != Some(0) {
        return Err(format!("QQ Music refused the lyrics request ({})", answer["req"]["code"]));
    }
    Ok(lyrics_of(&answer["req"]["data"], title))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_search_result_must_be_the_playing_song() {
        let search = json!({ "data": { "song": { "list": [
            { "songmid": "live", "songname": "晴天 (Live)", "singer": [{ "name": "周杰伦" }], "interval": 300 },
            { "songmid": "cover", "songname": "晴天", "singer": [{ "name": "翻唱者" }], "interval": 269 },
            { "songmid": "001abc", "songname": "晴天", "singer": [{ "name": "周杰伦" }], "interval": 269 },
            { "songmid": "bad&mid", "songname": "晴天", "singer": [{ "name": "周杰伦" }], "interval": 269 },
        ] } } });
        assert_eq!(best_song(&search, "晴天", "周杰伦", 269_500).as_deref(), Some("001abc"));
        assert_eq!(best_song(&search, "七里香", "周杰伦", 0), None);
        assert_eq!(best_song(&json!({}), "晴天", "周杰伦", 0), None);
    }

    #[test]
    fn qrc_wins_over_plain_lines_and_keeps_the_translation() {
        let data = json!({
            "lyric": "<QrcInfos><Lyric_1 LyricContent=\"[1000,1200]故事的(1000,600)小黄花(1600,600)\n[3000,900]从出生(3000,900)\"/></QrcInfos>",
            "trans": "[00:01.00]The little yellow flower\n[00:03.00]//\n",
        });
        let found = lyrics_of(&data, "晴天").unwrap();
        assert_eq!(found.lrc, "[00:01.00]<00:01.00>故事的<00:01.60>小黄花<00:02.20>\n[00:03.00]<00:03.00>从出生<00:03.90>\n");
        assert_eq!(found.translation.as_deref(), Some("[00:01.00]The little yellow flower\n"));
        let lines_only = lyrics_of(&json!({ "lyric": "[00:01.00]故事的小黄花 从出生那年就飘着\n" }), "晴天").unwrap();
        assert_eq!(lines_only.lrc, "[00:01.00]故事的小黄花 从出生那年就飘着\n");
        assert_eq!(lyrics_of(&json!({ "lyric": "not hex" }), "晴天"), None);
        assert_eq!(lyrics_of(&json!({ "lyric": "" }), "晴天"), None);
    }
}
