use serde_json::Value;

use super::amll;
use super::found::{browser_client, from_lines, lrc_lines, FoundLyrics};
use super::krc::{KrcLine, KrcWord};
use super::matching::same_track;

const SEARCH: &str = "http://music.163.com/api/search/get/web";
const WORD_LYRIC: &str = "https://music.163.com/api/song/lyric/v1";
const LYRIC: &str = "https://music.163.com/api/song/lyric";
const REFERER: &str = "https://music.163.com/";

pub(super) fn best_song(search: &Value, title: &str, artist: &str, duration_ms: i64) -> Option<u64> {
    search["result"]["songs"]
        .as_array()?
        .iter()
        .filter_map(|song| {
            let artists: Vec<&str> = song["artists"].as_array()?.iter().filter_map(|artist| artist["name"].as_str()).collect();
            let length = song["duration"].as_i64().unwrap_or(0);
            let found = (song["name"].as_str()?, artists.join(", "), length);
            same_track((title, artist, duration_ms), (found.0, &found.1, found.2)).then(|| (song["id"].as_u64(), length))
        })
        .filter_map(|(id, length)| Some((id?, length)))
        .enumerate()
        .min_by_key(|(index, (_, length))| if duration_ms > 0 { (duration_ms - length).abs() } else { *index as i64 })
        .map(|(_, (id, _))| id)
}

pub(super) fn track_id(player_id: Option<&str>) -> Option<u64> {
    player_id?.strip_prefix("NCM-")?.parse().ok()
}

async fn get_json(client: &reqwest::Client, url: &str, query: &[(&str, String)]) -> Result<Value, String> {
    let url = reqwest::Url::parse_with_params(url, query).map_err(|error| error.to_string())?;
    let response = client
        .get(url)
        .header("Referer", REFERER)
        .send()
        .await
        .map_err(|error| format!("Could not reach NetEase: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("NetEase answered {}", response.status()));
    }
    response.json().await.map_err(|error| format!("NetEase sent something unexpected: {error}"))
}

fn yrc_line(text: &str) -> Option<KrcLine> {
    let (timing, mut rest) = text.trim().strip_prefix('[')?.split_once(']')?;
    let start_ms: u64 = timing.split_once(',')?.0.trim().parse().ok()?;
    let mut words = Vec::new();
    while let Some(tail) = rest.strip_prefix('(') {
        let (timing, tail) = tail.split_once(')')?;
        let mut numbers = timing.split(',').map(|number| number.trim().parse::<u64>());
        let (Some(Ok(start)), Some(Ok(duration_ms))) = (numbers.next(), numbers.next()) else {
            return None;
        };
        let end = tail.find('(').unwrap_or(tail.len());
        words.push(KrcWord { offset_ms: start.saturating_sub(start_ms), duration_ms, text: tail[..end].to_string() });
        rest = &tail[end..];
    }
    let mut text: String = words.iter().map(|word| word.text.as_str()).collect();
    text.push_str(rest);
    Some(KrcLine { start_ms, text: text.trim().to_string(), words })
}

pub(super) fn yrc_lines(yrc: &str) -> Vec<(u64, String)> {
    yrc.lines().filter_map(yrc_line).map(|line| (line.start_ms, line.timed_text())).collect()
}

pub(super) fn lyrics_of(answer: &Value, title: &str) -> Option<FoundLyrics> {
    let words = yrc_lines(answer["yrc"]["lyric"].as_str().unwrap_or_default());
    let word_timed = words.iter().any(|(_, text)| text.contains('<'));
    let (lines, translation) = if word_timed {
        (words, answer["ytlrc"]["lyric"].as_str().or_else(|| answer["tlyric"]["lyric"].as_str()))
    } else {
        (lrc_lines(answer["lrc"]["lyric"].as_str()?), answer["tlyric"]["lyric"].as_str())
    };
    let translated = lrc_lines(translation.unwrap_or_default());
    let translations: Vec<String> = lines
        .iter()
        .map(|(ms, _)| translated.iter().find(|(at, _)| at.abs_diff(*ms) < 50).map(|(_, text)| text.clone()).unwrap_or_default())
        .collect();
    let has_translation = translations.iter().any(|line| !line.is_empty());
    from_lines(&lines, has_translation.then_some(translations.as_slice()), title)
}

pub(super) async fn fetch(title: &str, artist: &str, duration_ms: i64, player_id: Option<&str>) -> Result<Option<FoundLyrics>, String> {
    let client = browser_client()?;
    let id = match track_id(player_id) {
        Some(id) => id,
        None => {
            let keyword = format!("{title} {artist}").trim().to_string();
            let query = [("s", keyword), ("type", "1".into()), ("offset", "0".into()), ("limit", "20".into())];
            let search = get_json(&client, SEARCH, &query).await?;
            let Some(id) = best_song(&search, title, artist, duration_ms) else {
                return Ok(None);
            };
            id
        }
    };
    let word_timed = tauri::async_runtime::spawn(amll::fetch(id));
    let query = [
        ("id", id.to_string()),
        ("lv", "-1".into()),
        ("kv", "-1".into()),
        ("tv", "-1".into()),
        ("yv", "-1".into()),
        ("ytv", "-1".into()),
        ("yrv", "-1".into()),
    ];
    let answer = match get_json(&client, WORD_LYRIC, &query).await {
        Ok(answer) => Ok(answer),
        Err(_) => get_json(&client, LYRIC, &query[..4]).await,
    };
    prefer_word_timed(word_timed.await.ok().flatten(), answer, title)
}

fn prefer_word_timed(word_timed: Option<FoundLyrics>, answer: Result<Value, String>, title: &str) -> Result<Option<FoundLyrics>, String> {
    match word_timed {
        Some(found) => Ok(Some(found)),
        None => Ok(lyrics_of(&answer?, title)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_search_result_must_be_the_playing_song() {
        let search = json!({ "code": 200, "result": { "songs": [
            { "id": 1, "name": "余香 (女声版)", "artists": [{ "name": "小匆匆" }], "duration": 244_000 },
            { "id": 2, "name": "余香", "artists": [{ "name": "张小九" }, { "name": "远Z" }], "duration": 228_816 },
            { "id": 3, "name": "余香", "artists": [{ "name": "张小九" }], "duration": 246_019 },
        ] } });
        assert_eq!(best_song(&search, "余香", "张小九", 246_000), Some(3));
        assert_eq!(best_song(&search, "余香", "张小九", 0), Some(2));
        assert_eq!(best_song(&search, "七里香", "周杰伦", 0), None);
        assert_eq!(track_id(Some("NCM-487885426")), Some(487_885_426));
        assert_eq!(track_id(Some("QQ-123")), None);
        assert_eq!(track_id(None), None);
    }

    #[test]
    fn lyrics_come_with_the_translation_lines_matched_by_time() {
        let answer = json!({
            "lrc": { "lyric": "[00:00.000] 作词 : 卡夫\n[00:17.518]Oh I believe\n[00:22.000]in yesterday\n" },
            "tlyric": { "lyric": "[00:17.520]哦 我相信\n" },
        });
        let found = lyrics_of(&answer, "Yesterday").unwrap();
        assert_eq!(found.lrc, "[00:17.51]Oh I believe\n[00:22.00]in yesterday\n");
        assert_eq!(found.translation.as_deref(), Some("[00:17.51]哦 我相信\n"));
        assert_eq!(lyrics_of(&json!({ "lrc": { "lyric": "[00:00.00] 作词 : x\n" } }), "A"), None);
    }

    #[test]
    fn word_timed_yrc_comes_before_the_line_lyrics() {
        let answer = json!({
            "yrc": { "lyric": "{\"t\":0,\"c\":[{\"tx\":\"作词: \"}]}\n[17518,1500](17518,300,0)Oh (17818,400,0)I (18218,800,0)believe\n[20000,500]\n" },
            "ytlrc": { "lyric": "[00:17.518]哦 我相信\n" },
            "lrc": { "lyric": "[00:17.518]Oh I believe\n" },
            "tlyric": { "lyric": "[00:17.518]逐行翻译\n" },
        });
        let found = lyrics_of(&answer, "Yesterday").unwrap();
        assert_eq!(found.lrc, "[00:17.51]<00:17.51>Oh <00:17.81>I <00:18.21>believe<00:19.01>\n[00:20.00]\n");
        assert_eq!(found.translation.as_deref(), Some("[00:17.51]哦 我相信\n"));
        let broken = json!({ "yrc": { "lyric": "[0,20](x,1,0)a" }, "lrc": { "lyric": "[00:17.518]Oh I believe\n" } });
        assert_eq!(lyrics_of(&broken, "Yesterday").unwrap().lrc, "[00:17.51]Oh I believe\n");
        assert_eq!(yrc_lines("[1000,500]plain"), [(1000, "plain".to_string())]);
    }

    #[test]
    fn the_word_timed_database_wins_and_netease_is_the_fallback() {
        let amll = FoundLyrics { lrc: "[00:01.00]<00:01.00>Oh<00:02.00>\n".into(), translation: None };
        let line = json!({ "lrc": { "lyric": "[00:17.518]Oh I believe\n" } });
        assert_eq!(prefer_word_timed(Some(amll.clone()), Err("offline".into()), "A"), Ok(Some(amll.clone())));
        assert_eq!(prefer_word_timed(Some(amll.clone()), Ok(line.clone()), "A"), Ok(Some(amll)));
        assert_eq!(prefer_word_timed(None, Ok(line), "A").unwrap().unwrap().lrc, "[00:17.51]Oh I believe\n");
        assert_eq!(prefer_word_timed(None, Err("offline".into()), "A"), Err("offline".into()));
    }
}
