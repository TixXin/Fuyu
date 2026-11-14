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

fn original_path(id: &str) -> Option<String> {
    super::service()
        .ok()?
        .snapshot()
        .ok()?
        .items
        .into_iter()
        .find(|item| item.id == id)
        .and_then(|item| item.image.map(|image| image.original_path))
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response
}

pub(crate) fn respond(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let Some(path) = item_id(request.uri().path()).and_then(|id| original_path(&id)) else {
        return status(StatusCode::NOT_FOUND);
    };
    match std::fs::read(path) {
        Ok(bytes) => {
            let mut response = Response::new(bytes);
            let headers = response.headers_mut();
            headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static("image/png"));
            headers.insert(header::CACHE_CONTROL, header::HeaderValue::from_static("private, max-age=86400, immutable"));
            response
        }
        Err(_) => status(StatusCode::NOT_FOUND),
    }
}

#[cfg(test)]
mod tests {
    use super::item_id;

    #[test]
    fn the_path_is_one_history_id() {
        assert_eq!(item_id("/1731571200000-abc").as_deref(), Some("1731571200000-abc"));
        assert_eq!(item_id("/a%2Db").as_deref(), Some("a-b"));
        assert_eq!(item_id("/a/b"), None);
        assert_eq!(item_id("/..%2Fsecret"), None);
        assert_eq!(item_id("/"), None);
        assert_eq!(item_id("/%zz"), None);
    }
}
