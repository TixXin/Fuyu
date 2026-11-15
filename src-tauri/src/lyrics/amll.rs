use std::time::Duration;

use super::found::FoundLyrics;
use super::ttml;
use crate::system::updater::get_updater_proxy;

const BASE: &str = "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/ncm-lyrics";
const TIMEOUT: Duration = Duration::from_secs(4);
const MAX_BYTES: usize = 1024 * 1024;
const USER_AGENT: &str = concat!("Fuyu/", env!("CARGO_PKG_VERSION"), " (https://github.com/TixXin/fuyu)");

fn url(netease_id: u64) -> String {
    format!("{BASE}/{netease_id}.ttml")
}

fn lyrics_of(status: u16, body: &[u8]) -> Option<FoundLyrics> {
    if status != 200 || body.len() > MAX_BYTES {
        return None;
    }
    ttml::to_lyrics(String::from_utf8_lossy(body).trim_start_matches('\u{feff}'))
}

pub(super) async fn fetch(netease_id: u64) -> Option<FoundLyrics> {
    let mut builder = reqwest::Client::builder().timeout(TIMEOUT).user_agent(USER_AGENT);
    if let Some(proxy) = get_updater_proxy() {
        builder = builder.proxy(reqwest::Proxy::all(&proxy).ok()?);
    }
    let response = builder.build().ok()?.get(url(netease_id)).send().await.ok()?;
    let status = response.status().as_u16();
    let body = response.bytes().await.ok()?;
    lyrics_of(status, &body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_database_file_is_used_only_when_it_exists_and_parses() {
        assert_eq!(url(2_048_982_668), "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/ncm-lyrics/2048982668.ttml");
        let ttml = r#"<tt><body><div><p begin="00:00.686" end="00:01.193"><span begin="00:00.686" end="00:01.020">Couldn't</span><span begin="00:01.020" end="00:01.193"> beat</span><span ttm:role="x-translation">她露出笑容</span></p></div></body></tt>"#;
        let found = lyrics_of(200, ttml.as_bytes()).unwrap();
        assert_eq!(found.lrc, "[00:00.68]<00:00.68>Couldn't<00:01.02> beat<00:01.19>\n[00:01.19]\n");
        assert_eq!(found.translation.as_deref(), Some("[00:00.68]她露出笑容\n"));
        assert_eq!(lyrics_of(404, b"404: Not Found"), None);
        assert_eq!(lyrics_of(200, b"<html>rate limited</html>"), None);
        assert_eq!(lyrics_of(200, &vec![b' '; MAX_BYTES + 1]), None);
    }
}
