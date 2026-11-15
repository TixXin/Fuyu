use std::path::{Component, Path, PathBuf};

use tauri::http::{header, HeaderValue, Method, Request, Response, StatusCode};

pub(crate) const SCHEME: &str = "fuyu-plugin";

const SHIMS: [(&str, &str); 2] = [
    ("__shared/react.js", include_str!("../../../packages/plugin-base/src/client/shims/react.js")),
    ("__shared/react-jsx-runtime.js", include_str!("../../../packages/plugin-base/src/client/shims/react-jsx-runtime.js")),
];

fn mime(path: &str) -> &'static str {
    match path.rsplit('.').next().map(str::to_ascii_lowercase).as_deref() {
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json" | "map") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        _ => "application/octet-stream",
    }
}

fn decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            out.push(u8::from_str_radix(value.get(index + 1..index + 3)?, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

pub(crate) fn relative_path(uri_path: &str) -> Option<String> {
    let path = decode(uri_path.trim_start_matches('/'))?;
    let parts = Path::new(&path).components().collect::<Vec<_>>();
    if path.is_empty() || path.contains('\\') || parts.iter().any(|part| !matches!(part, Component::Normal(_))) {
        return None;
    }
    Some(path)
}

pub(crate) fn locate(root: &Path, relative: &str) -> Option<PathBuf> {
    let root = std::fs::canonicalize(root).ok()?;
    let file = std::fs::canonicalize(root.join(relative)).ok()?;
    (file.starts_with(&root) && file.is_file()).then_some(file)
}

fn respond_with(status: StatusCode, content_type: &'static str, body: Vec<u8>, head: bool) -> Response<Vec<u8>> {
    let length = body.len();
    let mut response = Response::new(if head { Vec::new() } else { body });
    *response.status_mut() = status;
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    if let Ok(value) = HeaderValue::from_str(&length.to_string()) {
        headers.insert(header::CONTENT_LENGTH, value);
    }
    response
}

fn missing(head: bool) -> Response<Vec<u8>> {
    respond_with(StatusCode::NOT_FOUND, "text/plain; charset=utf-8", b"not found".to_vec(), head)
}

pub(crate) fn respond(root: Option<&Path>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let head = request.method() == Method::HEAD;
    if request.method() != Method::GET && !head {
        return respond_with(StatusCode::METHOD_NOT_ALLOWED, "text/plain; charset=utf-8", Vec::new(), head);
    }
    let Some(root) = root else { return missing(head) };
    let Some(relative) = relative_path(request.uri().path()) else { return missing(head) };
    if let Some((_, text)) = SHIMS.iter().find(|(path, _)| *path == relative) {
        return respond_with(StatusCode::OK, mime(&relative), text.as_bytes().to_vec(), head);
    }
    match locate(root, &relative).map(std::fs::read) {
        Some(Ok(bytes)) => respond_with(StatusCode::OK, mime(&relative), bytes, head),
        _ => missing(head),
    }
}
