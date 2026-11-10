//! A copied link's page title and icon (C38), only when "link previews" is on: it visits the
//! address. The page is read up to MAX_PAGE_BYTES and the icon up to MAX_ICON_BYTES; nothing else
//! on the page is loaded and no cookies are kept.

use base64::{engine::general_purpose, Engine as _};
use reqwest::Url;
use serde::Serialize;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(6);
const MAX_PAGE_BYTES: usize = 512 * 1024;
const MAX_ICON_BYTES: usize = 128 * 1024;
const MAX_TITLE_CHARS: usize = 200;

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreview {
    title: Option<String>,
    /// The site icon as a data URL.
    icon: Option<String>,
}

pub(super) async fn fetch(url: &str) -> Result<LinkPreview, String> {
    let url = Url::parse(url).map_err(|error| format!("Not a link: {error}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only http and https links are read.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(TIMEOUT)
        .redirect(reqwest::redirect::Policy::limited(5))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Fuyu")
        .build()
        .map_err(|error| error.to_string())?;
    let (page, final_url) = read(&client, url.clone(), MAX_PAGE_BYTES).await?;
    let html = String::from_utf8_lossy(&page.0);
    let title = page_title(&html);
    let icon_url = icon_href(&html)
        .and_then(|href| final_url.join(&href).ok())
        .or_else(|| final_url.join("/favicon.ico").ok());
    let icon = match icon_url {
        Some(icon_url) => read(&client, icon_url, MAX_ICON_BYTES)
            .await
            .ok()
            .and_then(|(icon, _)| icon.1.filter(|kind| kind.starts_with("image/")).map(|kind| format!("data:{kind};base64,{}", general_purpose::STANDARD.encode(&icon.0)))),
        None => None,
    };
    Ok(LinkPreview { title, icon })
}

/// The body (cut at `limit`), its content type, and the address after redirects.
async fn read(client: &reqwest::Client, url: Url, limit: usize) -> Result<((Vec<u8>, Option<String>), Url), String> {
    let mut response = client.get(url).send().await.map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status().as_u16()));
    }
    let final_url = response.url().clone();
    let kind = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or_default().trim().to_ascii_lowercase());
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        body.extend_from_slice(&chunk);
        if body.len() >= limit {
            body.truncate(limit);
            break;
        }
    }
    Ok(((body, kind), final_url))
}

/// The `<... name="value">` attribute of one tag, case-insensitive, quoted either way.
fn attribute(tag: &str, name: &str) -> Option<String> {
    let lower = tag.to_ascii_lowercase();
    let mut from = 0;
    while let Some(found) = lower[from..].find(name) {
        let start = from + found;
        from = start + name.len();
        let before_ok = start == 0 || lower.as_bytes()[start - 1].is_ascii_whitespace();
        let rest = lower[from..].trim_start();
        if !before_ok || !rest.starts_with('=') {
            continue;
        }
        let value_start = tag.len() - rest.len() + 1;
        let value = tag[value_start..].trim_start();
        let quote = value.chars().next()?;
        return Some(if quote == '"' || quote == '\'' {
            value[1..].split(quote).next().unwrap_or_default().to_string()
        } else {
            value.split(|c: char| c.is_whitespace() || c == '>').next().unwrap_or_default().to_string()
        });
    }
    None
}

/// Every `<name ...>` tag in the page head, as written.
fn tags<'a>(html: &'a str, name: &str) -> Vec<&'a str> {
    let lower = html.to_ascii_lowercase();
    let open = format!("<{name}");
    let mut found = Vec::new();
    let mut from = 0;
    while let Some(index) = lower[from..].find(&open) {
        let start = from + index;
        let Some(end) = lower[start..].find('>') else { break };
        found.push(&html[start..start + end + 1]);
        from = start + end + 1;
    }
    found
}

fn decode_entities(text: &str) -> String {
    text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").replace("&#x27;", "'").replace("&nbsp;", " ")
}

fn clean(text: &str) -> Option<String> {
    let text = decode_entities(text).split_whitespace().collect::<Vec<_>>().join(" ");
    (!text.is_empty()).then(|| text.chars().take(MAX_TITLE_CHARS).collect())
}

pub(super) fn page_title(html: &str) -> Option<String> {
    let og = tags(html, "meta").into_iter().find_map(|tag| {
        let property = attribute(tag, "property").or_else(|| attribute(tag, "name"))?;
        (property.eq_ignore_ascii_case("og:title")).then(|| attribute(tag, "content")).flatten()
    });
    og.and_then(|title| clean(&title)).or_else(|| {
        let lower = html.to_ascii_lowercase();
        let start = lower.find("<title")?;
        let open_end = start + lower[start..].find('>')? + 1;
        let close = open_end + lower[open_end..].find("</title")?;
        clean(&html[open_end..close])
    })
}

pub(super) fn icon_href(html: &str) -> Option<String> {
    tags(html, "link").into_iter().find_map(|tag| {
        let rel = attribute(tag, "rel")?.to_ascii_lowercase();
        rel.split_whitespace().any(|word| word == "icon" || word == "apple-touch-icon").then(|| attribute(tag, "href")).flatten()
    })
}

#[cfg(test)]
mod tests {
    use super::{icon_href, page_title};

    #[test]
    fn titles_and_icons_come_from_the_page_head() {
        let page = r#"<html><head><title> Old &amp; plain </title><meta content="Pull Request #26" property="og:title"><link rel="shortcut icon" href='/fav.png'></head>"#;
        assert_eq!(page_title(page).as_deref(), Some("Pull Request #26"));
        assert_eq!(icon_href(page).as_deref(), Some("/fav.png"));
        assert_eq!(page_title("<TITLE>A &amp; B</TITLE>").as_deref(), Some("A & B"));
        assert_eq!(page_title("<p>none</p>"), None);
        assert_eq!(icon_href("<link rel=stylesheet href=a.css>"), None);
    }
}
