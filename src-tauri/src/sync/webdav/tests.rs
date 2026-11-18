use std::{
    collections::{BTreeMap, BTreeSet},
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use serde_json::json;

use super::{
    is_local_or_private_host, normalize_webdav_url,
    rate_limit::{EtagToken, RateLimiter, WINDOW_DURATION, WINDOW_REQUEST_LIMIT},
    xml::{decoded_segments, extract_href_path, parse_multistatus},
    WebdavBackend,
};
use crate::sync::{
    backend::{Backend, BackendError, Listed},
    config::{self, SyncBackendKind, SyncConfig, WebdavConfig},
    round::{Options, RoundResult},
    test_devices::{temp, todo, Device},
    Tombstone,
};

#[derive(Clone, Copy, PartialEq, Eq)]
enum EtagFlavor {
    NutstoreUnquoted,
    SynologyQuoted,
}

struct MockDavState {
    dirs: BTreeSet<String>,
    files: BTreeMap<String, (Vec<u8>, u64)>,
    etag_flavor: EtagFlavor,
    expected_auth: String,
    fail_503_remaining: usize,
    always_429_retry_after: Option<u64>,
    paginate_page_size: Option<usize>,
    redirect_without_slash: bool,
    saw_non_identity_encoding: bool,
    request_log: Vec<(String, String)>,
    next_rev: u64,
}

impl MockDavState {
    fn new(expected_auth: &str, etag_flavor: EtagFlavor) -> Self {
        let mut dirs = BTreeSet::new();
        dirs.insert("/dav".to_string());
        dirs.insert("/dav/我的坚果云".to_string());
        Self {
            dirs,
            files: BTreeMap::new(),
            etag_flavor,
            expected_auth: expected_auth.to_string(),
            fail_503_remaining: 0,
            always_429_retry_after: None,
            paginate_page_size: None,
            redirect_without_slash: false,
            saw_non_identity_encoding: false,
            request_log: Vec::new(),
            next_rev: 1,
        }
    }

    fn format_etag(&self, rev: u64) -> String {
        match self.etag_flavor {
            EtagFlavor::NutstoreUnquoted => format!("etag-{rev}"),
            EtagFlavor::SynologyQuoted => format!("\"etag-{rev}\""),
        }
    }
}

struct MockDavServer {
    addr: std::net::SocketAddr,
    state: Arc<Mutex<MockDavState>>,
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl MockDavServer {
    fn start(user: &str, pass: &str, etag_flavor: EtagFlavor) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock webdav");
        listener.set_nonblocking(true).expect("nonblocking");
        let addr = listener.local_addr().expect("local addr");
        let expected_auth = format!("Basic {}", base64_encode(format!("{user}:{pass}").as_bytes()));
        let state = Arc::new(Mutex::new(MockDavState::new(&expected_auth, etag_flavor)));
        let stop = Arc::new(AtomicBool::new(false));
        let state_bg = state.clone();
        let stop_bg = stop.clone();
        let handle = thread::spawn(move || {
            while !stop_bg.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((stream, _)) => {
                        let _ = stream.set_nonblocking(false);
                        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                        handle_conn(stream, &state_bg);
                    }
                    Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(5));
                    }
                    Err(_) => break,
                }
            }
        });
        Self { addr, state, stop, handle: Some(handle) }
    }

    fn url(&self, suffix: &str) -> String {
        format!("http://{}{suffix}", self.addr)
    }
}

impl Drop for MockDavServer {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((triple >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3f) as usize] as char);
        out.push(if chunk.len() > 1 { TABLE[((triple >> 6) & 0x3f) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[(triple & 0x3f) as usize] as char } else { '=' });
    }
    out
}

fn percent_encode_path(path: &str) -> String {
    let mut out = String::new();
    for part in path.split('/') {
        if part.is_empty() {
            continue;
        }
        out.push('/');
        for byte in part.as_bytes() {
            if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'_' | b'.' | b'~') {
                out.push(*byte as char);
            } else {
                out.push_str(&format!("%{byte:02X}"));
            }
        }
    }
    out
}

struct ParsedHttpRequest {
    method: String,
    raw_target: String,
    headers: BTreeMap<String, String>,
    body: Vec<u8>,
}

fn read_http_request(stream: &mut TcpStream) -> Option<ParsedHttpRequest> {
    let mut buf = Vec::new();
    let mut temp_buf = [0_u8; 4096];
    let header_end = loop {
        let n = stream.read(&mut temp_buf).ok()?;
        if n == 0 {
            return None;
        }
        buf.extend_from_slice(&temp_buf[..n]);
        if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            break pos;
        }
        if buf.len() > 65536 {
            return None;
        }
    };
    let head = String::from_utf8_lossy(&buf[..header_end]).to_string();
    let mut lines = head.split("\r\n");
    let first = lines.next()?;
    let mut first_parts = first.split_whitespace();
    let method = first_parts.next()?.to_string();
    let raw_target = first_parts.next()?.to_string();
    let mut headers = BTreeMap::new();
    for line in lines {
        if let Some((name, val)) = line.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), val.trim().to_string());
        }
    }
    let content_len: usize = headers
        .get("content-length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    let mut body = buf[header_end + 4..].to_vec();
    while body.len() < content_len {
        let n = stream.read(&mut temp_buf).ok()?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&temp_buf[..n]);
    }
    body.truncate(content_len);
    Some(ParsedHttpRequest { method, raw_target, headers, body })
}

fn write_http_response(stream: &mut TcpStream, status: &str, extra_headers: &[(&str, String)], body: &[u8]) {
    let mut head = format!("HTTP/1.1 {status}\r\nConnection: close\r\nContent-Length: {}\r\n", body.len());
    for (k, v) in extra_headers {
        head.push_str(&format!("{k}: {v}\r\n"));
    }
    head.push_str("\r\n");
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn normalize_server_path(decoded: &str) -> String {
    let trimmed = decoded.trim_end_matches('/');
    if trimmed.is_empty() { "/".to_string() } else { trimmed.to_string() }
}

fn parent_of(path: &str) -> Option<String> {
    let trimmed = path.trim_end_matches('/');
    let idx = trimmed.rfind('/')?;
    if idx == 0 { Some("/".to_string()) } else { Some(trimmed[..idx].to_string()) }
}

fn handle_conn(mut stream: TcpStream, state: &Arc<Mutex<MockDavState>>) {
    let Some(ParsedHttpRequest { method, raw_target, headers, body }) = read_http_request(&mut stream) else {
        return;
    };
    let (decoded_target, had_trailing_slash) = extract_href_path(&raw_target);
    let norm_path = normalize_server_path(&decoded_target);

    let mut st = state.lock().expect("lock mock state");
    st.request_log.push((method.clone(), norm_path.clone()));
    if headers.get("accept-encoding").map(String::as_str) != Some("identity") {
        st.saw_non_identity_encoding = true;
    }
    if headers.get("authorization") != Some(&st.expected_auth) {
        write_http_response(&mut stream, "401 Unauthorized", &[("WWW-Authenticate", "Basic realm=\"dav\"".into())], b"");
        return;
    }
    if let Some(secs) = st.always_429_retry_after {
        write_http_response(&mut stream, "429 Too Many Requests", &[("Retry-After", secs.to_string())], b"rate limited");
        return;
    }
    if st.fail_503_remaining > 0 {
        st.fail_503_remaining -= 1;
        write_http_response(&mut stream, "503 Service Unavailable", &[], b"busy");
        return;
    }
    if st.redirect_without_slash && method == "PROPFIND" && !had_trailing_slash && st.dirs.contains(&norm_path) {
        let loc = format!("{}/", percent_encode_path(&norm_path));
        write_http_response(&mut stream, "301 Moved Permanently", &[("Location", loc)], b"");
        return;
    }

    match method.as_str() {
        "PROPFIND" => {
            let depth = headers.get("depth").map(String::as_str).unwrap_or("0");
            if st.dirs.contains(&norm_path) {
                let mut responses = Vec::new();
                let self_href = format!("{}/", percent_encode_path(&norm_path));
                responses.push(format!(
                    "<D:response><D:href>{self_href}</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat><D:propstat><D:prop><D:getetag/></D:prop><D:status>HTTP/1.1 404 Not Found</D:status></D:propstat></D:response>"
                ));
                if depth == "1" {
                    let mut children = Vec::new();
                    for dir in &st.dirs {
                        if dir != &norm_path && parent_of(dir).as_deref() == Some(norm_path.as_str()) {
                            let href = format!("{}/", percent_encode_path(dir));
                            children.push(format!(
                                "<D:response><D:href>{href}</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>"
                            ));
                        }
                    }
                    for (file, (_, rev)) in &st.files {
                        if parent_of(file).as_deref() == Some(norm_path.as_str()) {
                            let href = percent_encode_path(file);
                            let etag = st.format_etag(*rev);
                            children.push(format!(
                                "<D:response><D:href>{href}</D:href><D:propstat><D:prop><D:resourcetype/><D:getetag>{etag}</D:getetag></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>"
                            ));
                        }
                    }
                    if let Some(page_size) = st.paginate_page_size {
                        let total = 1 + children.len();
                        let offset: usize = headers
                            .get("x-nc-paginate-offset")
                            .and_then(|v| v.parse().ok())
                            .unwrap_or(0);
                        let slice = children.into_iter().skip(offset).take(page_size).collect::<Vec<_>>();
                        responses.extend(slice);
                        let xml = format!("<?xml version=\"1.0\" encoding=\"utf-8\"?><D:multistatus xmlns:D=\"DAV:\">{}</D:multistatus>", responses.join(""));
                        write_http_response(
                            &mut stream,
                            "207 Multi-Status",
                            &[
                                ("Content-Type", "application/xml; charset=utf-8".into()),
                                ("X-NC-Paginate-Total", total.to_string()),
                            ],
                            xml.as_bytes(),
                        );
                        return;
                    }
                    responses.extend(children);
                }
                let xml = format!("<?xml version=\"1.0\" encoding=\"utf-8\"?><D:multistatus xmlns:D=\"DAV:\">{}</D:multistatus>", responses.join(""));
                write_http_response(
                    &mut stream,
                    "207 Multi-Status",
                    &[("Content-Type", "application/xml; charset=utf-8".into())],
                    xml.as_bytes(),
                );
            } else if let Some((_, rev)) = st.files.get(&norm_path) {
                let href = percent_encode_path(&norm_path);
                let etag = st.format_etag(*rev);
                let xml = format!(
                    "<?xml version=\"1.0\" encoding=\"utf-8\"?><D:multistatus xmlns:D=\"DAV:\"><D:response><D:href>{href}</D:href><D:propstat><D:prop><D:resourcetype/><D:getetag>{etag}</D:getetag></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>"
                );
                write_http_response(
                    &mut stream,
                    "207 Multi-Status",
                    &[("Content-Type", "application/xml; charset=utf-8".into())],
                    xml.as_bytes(),
                );
            } else {
                write_http_response(&mut stream, "404 Not Found", &[], b"");
            }
        }
        "MKCOL" => {
            if st.dirs.contains(&norm_path) {
                write_http_response(&mut stream, "405 Method Not Allowed", &[], b"");
            } else if parent_of(&norm_path).is_some_and(|p| st.dirs.contains(&p)) {
                st.dirs.insert(norm_path);
                write_http_response(&mut stream, "201 Created", &[], b"");
            } else {
                write_http_response(&mut stream, "409 Conflict", &[], b"");
            }
        }
        "GET" => {
            if let Some((bytes, rev)) = st.files.get(&norm_path).cloned() {
                let etag = st.format_etag(rev);
                write_http_response(&mut stream, "200 OK", &[("ETag", etag)], &bytes);
            } else {
                write_http_response(&mut stream, "404 Not Found", &[], b"");
            }
        }
        "PUT" => {
            if !parent_of(&norm_path).is_some_and(|p| st.dirs.contains(&p)) {
                write_http_response(&mut stream, "409 Conflict", &[], b"");
                return;
            }
            if let Some(if_match) = headers.get("if-match") {
                if let Some((_, current_rev)) = st.files.get(&norm_path) {
                    let expected = st.format_etag(*current_rev);
                    if if_match != &expected {
                        write_http_response(&mut stream, "412 Precondition Failed", &[], b"");
                        return;
                    }
                }
            }
            let rev = st.next_rev;
            st.next_rev += 1;
            let etag = st.format_etag(rev);
            st.files.insert(norm_path, (body, rev));
            write_http_response(&mut stream, "201 Created", &[("ETag", etag)], b"");
        }
        "DELETE" => {
            if st.files.remove(&norm_path).is_some() {
                write_http_response(&mut stream, "204 No Content", &[], b"");
            } else {
                write_http_response(&mut stream, "404 Not Found", &[], b"");
            }
        }
        _ => {
            write_http_response(&mut stream, "405 Method Not Allowed", &[], b"");
        }
    }
}

#[test]
fn url_validation_enforces_https_on_internet_allows_lan_http_and_guards_nutstore_root() {
    assert_eq!(normalize_webdav_url("").unwrap_err().code(), "sync.webdavUrl");
    assert_eq!(
        normalize_webdav_url("https://alice:secret@dav.example.com/dav/").unwrap_err().code(),
        "sync.webdavUrlCredentials"
    );
    assert_eq!(
        normalize_webdav_url("http://dav.jianguoyun.com/dav/fuyu/").unwrap_err().code(),
        "sync.webdavScheme"
    );
    assert_eq!(
        normalize_webdav_url("https://dav.jianguoyun.com/dav/").unwrap_err().code(),
        "sync.webdavNutstoreRoot"
    );
    assert_eq!(
        normalize_webdav_url("https://dav.jianguoyun.com/dav").unwrap_err().code(),
        "sync.webdavNutstoreRoot"
    );

    let nutstore = normalize_webdav_url("https://dav.jianguoyun.com/dav/我的坚果云").unwrap();
    assert!(nutstore.path().ends_with('/'));
    assert_eq!(decoded_segments(nutstore.path()), vec!["dav", "我的坚果云"]);

    let synology_lan = normalize_webdav_url("http://192.168.1.100:5005/FuyuSync").unwrap();
    assert_eq!(synology_lan.as_str(), "http://192.168.1.100:5005/FuyuSync/");
    assert!(is_local_or_private_host("192.168.1.100"));
    assert!(is_local_or_private_host("127.0.0.1"));
    assert!(is_local_or_private_host("nas.local"));
    assert!(!is_local_or_private_host("dav.jianguoyun.com"));
}

#[test]
fn multistatus_parser_handles_dual_propstat_chinese_hrefs_and_etag_flavors() {
    let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/%E6%88%91%E7%9A%84%E5%9D%9A%E6%9E%9C%E4%BA%91/fuyu-sync/devices/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
    <d:propstat>
      <d:prop><d:getetag/></d:prop>
      <d:status>HTTP/1.1 404 Not Found</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>https://dav.jianguoyun.com/dav/%E6%88%91%E7%9A%84%E5%9D%9A%E6%9E%9C%E4%BA%91/fuyu-sync/devices/deva/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>"#;

    let entries = parse_multistatus(xml).expect("valid multistatus");
    assert_eq!(entries.len(), 2);
    assert!(entries[0].is_collection);
    assert!(entries[1].is_collection);

    let unquoted = EtagToken::parse("abc123").expect("unquoted etag");
    assert_eq!(unquoted.if_match_candidates(), vec!["abc123", "\"abc123\""]);
    let quoted = EtagToken::parse("\"abc123\"").expect("quoted etag");
    assert_eq!(quoted.if_match_candidates(), vec!["\"abc123\"", "abc123"]);
    let weak = EtagToken::parse("W/\"abc123\"").expect("weak etag");
    assert!(weak.if_match_candidates().is_empty());
    assert!(parse_multistatus("<!DOCTYPE html><html><body>Login</body></html>").is_none());
}

#[test]
fn two_devices_sync_todos_and_deletions_over_webdav_with_both_etag_flavors() {
    for (label, flavor) in [
        ("nutstore", EtagFlavor::NutstoreUnquoted),
        ("synology", EtagFlavor::SynologyQuoted),
    ] {
        let server = MockDavServer::start("alice@example.com", "app-pass-123", flavor);
        server.state.lock().unwrap().redirect_without_slash = true;
        let base_url = server.url("/dav/我的坚果云/FuyuBox");

        let backend_a = WebdavBackend::new(&base_url, "alice@example.com", "app-pass-123").expect("backend a");
        let backend_b = WebdavBackend::new(&base_url, "alice@example.com", "app-pass-123").expect("backend b");
        tauri::async_runtime::block_on(backend_a.test_connection()).expect("test connection before folder exists");

        let root = temp(&format!("webdav-{label}"));
        let mut dev_a = Device::new("deva0001", &root);
        let mut dev_b = Device::new("devb0002", &root);

        let s1 = dev_a.stamp();
        let s2 = dev_a.stamp();
        dev_a.todos.data["todos"] = json!([todo("t1", "Ship WebDAV", &s1), todo("t2", "Write guide", &s2)]);

        assert!(matches!(dev_a.sync_backend(&backend_a, Options::default()), RoundResult::Done { .. }));
        assert!(matches!(dev_b.sync_backend(&backend_b, Options::default()), RoundResult::Done { .. }));
        assert_eq!(dev_b.todo_ids(), vec!["t1", "t2"]);

        dev_b.clock.wall = dev_a.clock.wall + 2_000;
        let del = dev_b.stamp();
        dev_b.todos.data["todos"] = json!([dev_b.todos.data["todos"][0].clone()]);
        dev_b.todos.data["tombstones"] = serde_json::to_value(vec![Tombstone::new("t2", del)]).unwrap();

        assert!(matches!(dev_b.sync_backend(&backend_b, Options::default()), RoundResult::Done { .. }));
        assert!(matches!(dev_a.sync_backend(&backend_a, Options::default()), RoundResult::Done { .. }));
        assert_eq!(dev_a.todo_ids(), vec!["t1"]);

        let state = server.state.lock().unwrap();
        assert!(!state.saw_non_identity_encoding, "every request must send Accept-Encoding: identity");
    }
}

#[test]
fn nextcloud_paginated_propfind_collects_all_device_entries() {
    let server = MockDavServer::start("nc-user", "nc-pass", EtagFlavor::SynologyQuoted);
    {
        let mut st = server.state.lock().unwrap();
        st.paginate_page_size = Some(2);
        st.dirs.insert("/dav/fuyu-sync".into());
        st.dirs.insert("/dav/fuyu-sync/devices".into());
        for idx in 1..=5 {
            st.dirs.insert(format!("/dav/fuyu-sync/devices/dev0000{idx}"));
        }
    }
    let backend = WebdavBackend::new(&server.url("/dav"), "nc-user", "nc-pass").unwrap();
    let listed = backend.list("fuyu-sync/devices").unwrap();
    assert_eq!(
        listed,
        (1..=5)
            .map(|idx| Listed { name: format!("dev0000{idx}"), is_dir: true })
            .collect::<Vec<_>>()
    );
}

#[test]
fn wrong_password_offline_503_backoff_and_request_budget_produce_clear_errors() {
    let server = MockDavServer::start("alice", "correct-app-pass", EtagFlavor::NutstoreUnquoted);

    let bad_auth = WebdavBackend::new(&server.url("/dav/我的坚果云"), "alice", "wrong-login-pass").unwrap();
    let auth_err = tauri::async_runtime::block_on(bad_auth.test_connection()).unwrap_err();
    assert_eq!(auth_err.code(), "sync.webdavAuth");
    assert!(!auth_err.to_string().contains("wrong-login-pass"));
    assert!(matches!(bad_auth.check(), Err(BackendError::Failed(_))));
    assert_eq!(bad_auth.take_last_error().unwrap().code(), "sync.webdavAuth");

    server.state.lock().unwrap().fail_503_remaining = 2;
    let retrying = WebdavBackend::new(&server.url("/dav/我的坚果云"), "alice", "correct-app-pass").unwrap();
    retrying.check().expect("recovers after two 503 responses");

    server.state.lock().unwrap().always_429_retry_after = Some(60);
    let limited = WebdavBackend::with_limiter(
        &server.url("/dav/我的坚果云"),
        "alice",
        "correct-app-pass",
        Arc::new(RateLimiter::new()),
    )
    .unwrap();
    assert!(matches!(limited.check(), Err(BackendError::Unavailable(_))));
    assert_eq!(limited.take_last_error().unwrap().code(), "sync.webdavRateLimited");
    server.state.lock().unwrap().always_429_retry_after = None;

    let tiny_budget = Arc::new(RateLimiter::with_limit(2));
    let budgeted = WebdavBackend::with_limiter(
        &server.url("/dav/我的坚果云"),
        "alice",
        "correct-app-pass",
        tiny_budget,
    )
    .unwrap();
    assert!(budgeted.read("fuyu-sync/meta.json").is_ok());
    assert!(budgeted.read("fuyu-sync/meta.json").is_ok());
    assert!(matches!(budgeted.read("fuyu-sync/meta.json"), Err(BackendError::Unavailable(_))));
    assert_eq!(budgeted.take_last_error().unwrap().code(), "sync.webdavRateLimited");

    let closed_addr = {
        let ephemeral = TcpListener::bind("127.0.0.1:0").unwrap();
        ephemeral.local_addr().unwrap()
    };
    let offline = WebdavBackend::new(&format!("http://{closed_addr}/dav"), "alice", "correct-app-pass").unwrap();
    let root = temp("webdav-offline");
    let mut dev = Device::new("deva0009", &root);
    assert!(matches!(dev.sync_backend(&offline, Options::default()), RoundResult::FolderMissing(_)));
    assert_eq!(offline.take_last_error().unwrap().code(), "sync.webdavOffline");
}

#[test]
fn rolling_window_limiter_tracks_600_requests_per_30_minutes() {
    assert_eq!(WINDOW_REQUEST_LIMIT, 600);
    let limiter = RateLimiter::new();
    let start = Instant::now();
    for step in 0..WINDOW_REQUEST_LIMIT {
        assert!(limiter.acquire(start + Duration::from_millis(step as u64)).is_ok());
    }
    assert!(limiter.acquire(start + Duration::from_secs(60)).is_err());
    assert!(limiter.acquire(start + WINDOW_DURATION + Duration::from_secs(1)).is_ok());
}

#[test]
fn legacy_folder_config_loads_compatibly_and_webdav_config_never_writes_password() {
    let dir = temp("sync-config-compat");
    std::fs::write(
        dir.join(config::FILE_NAME),
        r#"{"version":1,"folder":"/Users/demo/Sync","categories":["todos"],"optionalGroups":[]}"#,
    )
    .unwrap();
    let legacy = config::load(&dir);
    assert_eq!(legacy.active_backend(), SyncBackendKind::Folder);

    let webdav_cfg = SyncConfig {
        version: 1,
        backend: Some(SyncBackendKind::Webdav),
        folder: legacy.folder.clone(),
        webdav: Some(WebdavConfig {
            url: "https://dav.jianguoyun.com/dav/我的坚果云".into(),
            username: "alice@example.com".into(),
        }),
        categories: legacy.categories.clone(),
        optional_groups: Vec::new(),
    }
    .normalized();
    config::save(&dir, &webdav_cfg).unwrap();
    let raw = std::fs::read_to_string(dir.join(config::FILE_NAME)).unwrap();
    assert!(!raw.contains("password"));
    let loaded = config::load(&dir);
    assert_eq!(loaded.active_backend(), SyncBackendKind::Webdav);
    assert_eq!(loaded.webdav.as_ref().unwrap().url, "https://dav.jianguoyun.com/dav/我的坚果云/");

    super::secret::set_test_password_override(Some(None));
    assert!(!super::secret::has_password());
    super::secret::save_password("stored-app-secret").unwrap();
    assert!(super::secret::has_password());
    assert_eq!(super::secret::read_password().unwrap().as_deref(), Some("stored-app-secret"));

    let same_target = normalize_webdav_url("https://dav.jianguoyun.com/dav/我的坚果云").unwrap();
    let reused = crate::sync::engine::resolve_webdav_password_for_saved(
        loaded.webdav.as_ref(),
        &same_target,
        "alice@example.com",
        None,
    )
    .unwrap();
    assert_eq!(reused, "stored-app-secret");

    let other_host = normalize_webdav_url("https://evil.example.com/dav/").unwrap();
    let rejected = crate::sync::engine::resolve_webdav_password_for_saved(
        loaded.webdav.as_ref(),
        &other_host,
        "alice@example.com",
        None,
    )
    .unwrap_err();
    assert_eq!(rejected.code(), "sync.webdavNeedPassword");

    super::secret::delete_password().unwrap();
    assert!(!super::secret::has_password());
    super::secret::set_test_password_override(None);
}
