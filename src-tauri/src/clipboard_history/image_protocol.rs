use tauri::http::{header, Request, Response, StatusCode};

pub(crate) const SCHEME: &str = "fuyu-clip";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Asset {
    Original,
    Thumbnail,
}

pub(super) fn parse_path(path: &str) -> Option<(String, Asset)> {
    let raw = path.trim_start_matches('/');
    let (raw_id, asset) = match raw.strip_suffix("/thumb") {
        Some(prefix) => (prefix, Asset::Thumbnail),
        None => (raw, Asset::Original),
    };
    let id = percent_decode(raw_id)?;
    if id.is_empty() || id == "." || id == ".." || id.contains(['/', '\\', '\0']) {
        return None;
    }
    Some((id, asset))
}

fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for &byte in value.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(char::from(byte));
        } else {
            out.push('%');
            out.push_str(&format!("{byte:02X}"));
        }
    }
    out
}

pub(super) fn thumbnail_url_for_os(id: &str, hash: &str, windows: bool) -> String {
    let encoded = percent_encode(id);
    let version: String = hash.chars().take(16).collect();
    let query = if version.is_empty() {
        String::new()
    } else {
        format!("?v={}", percent_encode(&version))
    };
    if windows {
        format!("http://{SCHEME}.localhost/{encoded}/thumb{query}")
    } else {
        format!("{SCHEME}://localhost/{encoded}/thumb{query}")
    }
}

pub(super) fn thumbnail_url(id: &str, hash: &str) -> String {
    thumbnail_url_for_os(id, hash, cfg!(windows))
}

fn percent_decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = value.get(index + 1..index + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

pub(super) fn item_source(item: &super::ClipboardHistoryItem, asset: Asset) -> Option<(String, &'static str)> {
    match asset {
        Asset::Original => {
            if let Some(image) = &item.image {
                return (!image.original_path.is_empty()).then(|| (image.original_path.clone(), "image/png"));
            }
            item.file_image.as_ref()?;
            match item.files.as_deref() {
                Some([path]) => Some((path.clone(), content_type(path)?)),
                _ => None,
            }
        }
        Asset::Thumbnail => {
            let image = item.image.as_ref()?;
            if !image.thumbnail_path.is_empty() && std::path::Path::new(&image.thumbnail_path).is_file() {
                return Some((image.thumbnail_path.clone(), "image/png"));
            }
            (!image.original_path.is_empty()).then(|| (image.original_path.clone(), "image/png"))
        }
    }
}

fn content_type(path: &str) -> Option<&'static str> {
    let extension = std::path::Path::new(path).extension()?.to_str()?.to_ascii_lowercase();
    Some(match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => return None,
    })
}

fn resolve_source(id: &str, asset: Asset) -> Option<(String, &'static str)> {
    let service = super::service().ok()?;
    let state = service.state.lock().ok()?;
    state.items.iter().find(|item| item.id == id).and_then(|item| item_source(item, asset))
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response
}

pub(crate) fn respond(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let Some((path, kind)) = parse_path(request.uri().path()).and_then(|(id, asset)| resolve_source(&id, asset)) else {
        return status(StatusCode::NOT_FOUND);
    };
    match std::fs::read(path) {
        Ok(bytes) => {
            let mut response = Response::new(bytes);
            let headers = response.headers_mut();
            headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static(kind));
            headers.insert(header::CACHE_CONTROL, header::HeaderValue::from_static("private, max-age=86400, immutable"));
            response
        }
        Err(_) => status(StatusCode::NOT_FOUND),
    }
}

#[cfg(test)]
mod tests {
    use super::{content_type, item_source, parse_path, thumbnail_url_for_os, Asset};
    use crate::clipboard_history::ClipboardHistoryItem;

    #[test]
    fn the_path_routes_original_and_thumbnail_without_traversal() {
        assert_eq!(parse_path("/1731571200000-abc"), Some(("1731571200000-abc".into(), Asset::Original)));
        assert_eq!(parse_path("/1731571200000-abc/thumb"), Some(("1731571200000-abc".into(), Asset::Thumbnail)));
        assert_eq!(parse_path("/a%2Db"), Some(("a-b".into(), Asset::Original)));
        assert_eq!(parse_path("/a%2Db/thumb"), Some(("a-b".into(), Asset::Thumbnail)));
        assert_eq!(parse_path("/a/b"), None);
        assert_eq!(parse_path("/a/b/thumb"), None);
        assert_eq!(parse_path("/..%2Fsecret"), None);
        assert_eq!(parse_path("/..%2Fsecret/thumb"), None);
        assert_eq!(parse_path("/../thumb"), None);
        assert_eq!(parse_path("/"), None);
        assert_eq!(parse_path("/%zz"), None);
    }

    #[test]
    fn thumbnail_urls_match_custom_scheme_hosts_and_cache_version() {
        assert_eq!(
            thumbnail_url_for_os("1731571200000-abc", "0123456789abcdef9999", true),
            "http://fuyu-clip.localhost/1731571200000-abc/thumb?v=0123456789abcdef"
        );
        assert_eq!(
            thumbnail_url_for_os("1731571200000-abc", "0123456789abcdef9999", false),
            "fuyu-clip://localhost/1731571200000-abc/thumb?v=0123456789abcdef"
        );
    }

    #[test]
    fn thumbnail_source_uses_disk_thumb_and_falls_back_to_original() {
        let dir = std::env::temp_dir().join(format!("fuyu-clip-proto-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let original = dir.join("abc.png");
        let thumb = dir.join("abc-thumb.png");
        std::fs::write(&original, b"orig").expect("orig");
        std::fs::write(&thumb, b"thumb").expect("thumb");
        let entry: ClipboardHistoryItem = serde_json::from_value(serde_json::json!({
            "id": "i1", "kind": "image", "hash": "abc", "createdAt": 1, "copiedAt": 1, "preview": "1 x 1 image",
            "image": {
                "width": 1, "height": 1, "byteSize": 4,
                "originalPath": original.to_string_lossy(),
                "thumbnailPath": thumb.to_string_lossy(),
                "thumbnailDataUrl": null
            }
        }))
        .expect("item");
        assert_eq!(item_source(&entry, Asset::Thumbnail), Some((thumb.to_string_lossy().into_owned(), "image/png")));
        assert_eq!(item_source(&entry, Asset::Original), Some((original.to_string_lossy().into_owned(), "image/png")));
        std::fs::remove_file(&thumb).expect("rm thumb");
        assert_eq!(item_source(&entry, Asset::Thumbnail), Some((original.to_string_lossy().into_owned(), "image/png")));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn copied_image_files_are_served_by_their_own_type() {
        assert_eq!(content_type("/Users/a/PixPin_1.JPG"), Some("image/jpeg"));
        assert_eq!(content_type("C:\\shots\\a.webp"), Some("image/webp"));
        assert_eq!(content_type("/Users/a/notes.txt"), None);
        assert_eq!(content_type("/Users/a/noext"), None);
    }
}
