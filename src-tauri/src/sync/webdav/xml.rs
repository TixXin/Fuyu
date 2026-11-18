use quick_xml::{events::Event, Reader};
use reqwest::Url;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct DavEntry {
    pub href: String,
    pub is_collection: bool,
    pub etag: Option<String>,
}

#[derive(Default)]
struct PropStatDraft {
    is_collection: bool,
    etag: Option<String>,
    status_code: Option<u16>,
}

impl PropStatDraft {
    fn is_ok(&self) -> bool {
        self.status_code.is_none_or(|code| (200..300).contains(&code))
    }
}

fn parse_http_status_line(line: &str) -> Option<u16> {
    let mut parts = line.split_whitespace();
    let first = parts.next()?;
    if first.starts_with("HTTP/") {
        parts.next()?.parse().ok()
    } else {
        first.parse().ok()
    }
}

pub(crate) fn parse_multistatus(xml: &str) -> Option<Vec<DavEntry>> {
    let mut reader = Reader::from_str(xml);
    let mut saw_multistatus = false;
    let mut entries = Vec::new();
    let mut stack: Vec<String> = Vec::new();
    let mut current: Option<DavEntry> = None;
    let mut propstat: Option<PropStatDraft> = None;
    let mut response_status: Option<u16> = None;
    let mut direct_collection = false;
    let mut direct_etag: Option<String> = None;
    let mut text = String::new();

    loop {
        let event = match reader.read_event() {
            Ok(Event::Eof) => break,
            Err(_) => return None,
            Ok(event) => event,
        };
        match event {
            Event::Start(start) => {
                let name = String::from_utf8_lossy(start.local_name().as_ref()).to_ascii_lowercase();
                if name == "multistatus" {
                    saw_multistatus = true;
                } else if name == "response" {
                    current = Some(DavEntry::default());
                    response_status = None;
                    direct_collection = false;
                    direct_etag = None;
                } else if name == "propstat" && current.is_some() {
                    propstat = Some(PropStatDraft::default());
                }
                stack.push(name);
                text.clear();
            }
            Event::Empty(empty) => {
                let name = String::from_utf8_lossy(empty.local_name().as_ref()).to_ascii_lowercase();
                if name == "multistatus" {
                    saw_multistatus = true;
                } else if name == "collection" && stack.iter().any(|open| open == "resourcetype") {
                    if let Some(ps) = propstat.as_mut() {
                        ps.is_collection = true;
                    } else if current.is_some() {
                        direct_collection = true;
                    }
                }
            }
            Event::Text(content) => {
                if let Ok(decoded) = content.xml_content() {
                    text.push_str(&decoded);
                }
            }
            Event::CData(content) => text.push_str(&String::from_utf8_lossy(&content)),
            Event::GeneralRef(reference) => {
                let name = String::from_utf8_lossy(&reference).to_string();
                text.push_str(match name.as_str() {
                    "lt" => "<",
                    "gt" => ">",
                    "amp" => "&",
                    "quot" => "\"",
                    "apos" => "'",
                    _ => "",
                });
                if let Some(code) = name.strip_prefix('#') {
                    let value = code.strip_prefix('x').map_or_else(
                        || code.parse().ok(),
                        |hex| u32::from_str_radix(hex, 16).ok(),
                    );
                    text.extend(value.and_then(char::from_u32));
                }
            }
            Event::End(_) => {
                let name = stack.pop().unwrap_or_default();
                let parent = stack.last().map(String::as_str);
                match (name.as_str(), parent) {
                    ("href", Some("response")) => {
                        if let Some(entry) = current.as_mut() {
                            if entry.href.is_empty() {
                                entry.href = text.trim().to_string();
                            }
                        }
                    }
                    ("collection", _) if stack.iter().any(|open| open == "resourcetype") => {
                        if let Some(ps) = propstat.as_mut() {
                            ps.is_collection = true;
                        } else if current.is_some() {
                            direct_collection = true;
                        }
                    }
                    ("getetag", _) => {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() {
                            if let Some(ps) = propstat.as_mut() {
                                ps.etag = Some(trimmed.to_string());
                            } else if current.is_some() {
                                direct_etag = Some(trimmed.to_string());
                            }
                        }
                    }
                    ("status", Some("propstat")) => {
                        if let Some(ps) = propstat.as_mut() {
                            ps.status_code = parse_http_status_line(text.trim());
                        }
                    }
                    ("status", Some("response")) => {
                        response_status = parse_http_status_line(text.trim());
                    }
                    ("propstat", _) => {
                        if let (Some(entry), Some(ps)) = (current.as_mut(), propstat.take()) {
                            if ps.is_ok() {
                                entry.is_collection |= ps.is_collection;
                                if entry.etag.is_none() {
                                    entry.etag = ps.etag;
                                }
                            }
                        }
                    }
                    ("response", _) => {
                        if let Some(mut entry) = current.take() {
                            if response_status.is_none_or(|code| (200..300).contains(&code)) {
                                entry.is_collection |= direct_collection;
                                if entry.etag.is_none() {
                                    entry.etag = direct_etag.take();
                                }
                                if !entry.href.is_empty() {
                                    entries.push(entry);
                                }
                            }
                        }
                    }
                    _ => {}
                }
                text.clear();
            }
            _ => {}
        }
    }

    saw_multistatus.then_some(entries)
}

pub(crate) fn percent_decode_str(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut idx = 0;
    while idx < bytes.len() {
        if bytes[idx] == b'%' && idx + 2 < bytes.len() {
            let hi = (bytes[idx + 1] as char).to_digit(16);
            let lo = (bytes[idx + 2] as char).to_digit(16);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push(((h << 4) | l) as u8);
                idx += 3;
                continue;
            }
        }
        out.push(bytes[idx]);
        idx += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub(crate) fn extract_href_path(href: &str) -> (String, bool) {
    let trimmed = href.trim();
    let raw_path = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        Url::parse(trimmed).map(|url| url.path().to_string()).unwrap_or_default()
    } else {
        trimmed
            .split(['?', '#'])
            .next()
            .unwrap_or_default()
            .to_string()
    };
    let trailing_slash = raw_path.ends_with('/');
    (percent_decode_str(&raw_path), trailing_slash)
}

pub(crate) fn decoded_segments(path: &str) -> Vec<String> {
    percent_decode_str(path)
        .split('/')
        .filter(|part| !part.is_empty())
        .map(str::to_string)
        .collect()
}
