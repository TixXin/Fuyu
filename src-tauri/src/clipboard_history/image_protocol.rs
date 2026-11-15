use tauri::http::{header, Request, Response, StatusCode};

pub(crate) const SCHEME: &str = "fuyu-clip";

fn item_id(path: &str) -> Option<String> {
    let raw = path.trim_start_matches('/');
    let id = percent_decode(raw)?;
    (!id.is_empty() && !id.contains(['/', '\\'])).then_some(id)
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

fn original_source(item: super::ClipboardHistoryItem) -> Option<(String, &'static str)> {
    if let Some(image) = item.image {
        return Some((image.original_path, "image/png"));
    }
    item.file_image.as_ref()?;
    match item.files.as_deref() {
        Some([path]) => Some((path.clone(), content_type(path)?)),
        _ => None,
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

fn original_path(id: &str) -> Option<(String, &'static str)> {
    super::service()
        .ok()?
        .snapshot()
        .ok()?
        .items
        .into_iter()
        .find(|item| item.id == id)
        .and_then(original_source)
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response
}

pub(crate) fn respond(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let Some((path, kind)) = item_id(request.uri().path()).and_then(|id| original_path(&id)) else {
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
    use super::{content_type, item_id};

    #[test]
    fn the_path_is_one_history_id() {
        assert_eq!(item_id("/1731571200000-abc").as_deref(), Some("1731571200000-abc"));
        assert_eq!(item_id("/a%2Db").as_deref(), Some("a-b"));
        assert_eq!(item_id("/a/b"), None);
        assert_eq!(item_id("/..%2Fsecret"), None);
        assert_eq!(item_id("/"), None);
        assert_eq!(item_id("/%zz"), None);
    }

    #[test]
    fn copied_image_files_are_served_by_their_own_type() {
        assert_eq!(content_type("/Users/a/PixPin_1.JPG"), Some("image/jpeg"));
        assert_eq!(content_type("C:\\shots\\a.webp"), Some("image/webp"));
        assert_eq!(content_type("/Users/a/notes.txt"), None);
        assert_eq!(content_type("/Users/a/noext"), None);
    }
}
