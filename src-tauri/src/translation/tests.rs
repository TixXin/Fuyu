use super::provider::{completions_url, find_provider};
use super::request::{request, resolve_secret, Translated};
use super::{
    address, engines_with, parse_optional_shortcut, EngineSecret, TranslatorEngines, WantedBinding,
    DEFAULT_SELECTION_SHORTCUT, DEFAULT_SHORTCUT,
};
use crate::user_error::UserError;
use plugin_base::{Rpc, Serve, ServiceFailure};
use reqwest::Url;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

const SECRET: &str = "sk-fuyu-test-0123456789abcdef";

fn engine(status: &str, kind: &str, body: &str) -> (Url, mpsc::Receiver<String>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let reply = format!("HTTP/1.1 {status}\r\ncontent-type: {kind}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}", body.len());
    let (sender, received) = mpsc::channel();
    thread::spawn(move || {
        let Ok((stream, _)) = listener.accept() else { return };
        let mut reader = BufReader::new(stream);
        let mut seen = String::new();
        let mut length = 0;
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).unwrap_or(0) == 0 {
                break;
            }
            if let Some(value) = line.to_ascii_lowercase().strip_prefix("content-length:") {
                length = value.trim().parse().unwrap_or(0);
            }
            seen.push_str(&line);
            if line == "\r\n" {
                break;
            }
        }
        let mut body = vec![0; length];
        let _ = reader.read_exact(&mut body);
        seen.push_str(&String::from_utf8_lossy(&body));
        let _ = reader.get_mut().write_all(reply.as_bytes());
        let _ = sender.send(seen);
    });
    (Url::parse(&format!("http://{address}/chat/completions")).unwrap(), received)
}

fn ask(endpoint: Url, pieces: Option<&(dyn Fn(String) -> bool + Send + Sync)>) -> Result<Translated, UserError> {
    let provider = find_provider(Some("custom")).unwrap();
    tauri::async_runtime::block_on(request(provider, endpoint, "test-model", Some(SECRET), "Translate.", "hello", pieces))
}

fn ask_without_secret(endpoint: Url) -> Result<Translated, UserError> {
    let provider = find_provider(Some("custom")).unwrap();
    tauri::async_runtime::block_on(request(provider, endpoint, "test-model", None, "Translate.", "hello", None))
}

fn only_in_the_header(request: &str) {
    let lines: Vec<&str> = request.lines().filter(|line| line.contains(SECRET)).collect();
    assert_eq!(lines.len(), 1, "{request}");
    assert!(lines[0].to_ascii_lowercase().starts_with("authorization: bearer "), "{request}");
}

fn shown_to_the_host(error: UserError) -> String {
    let error = error.into_serve_error();
    format!("{} {} {}", error.code, error.message, error.data.map(|data| data.to_string()).unwrap_or_default())
}

#[test]
fn the_secret_goes_to_the_engine_only_as_the_bearer_header() {
    let (endpoint, seen) = engine("200 OK", "application/json", r#"{"choices":[{"message":{"content":"你好"},"finish_reason":"stop"}]}"#);
    let translated = ask(endpoint, None).unwrap();
    assert_eq!(translated, Translated { text: "你好".into(), engine: "custom" });
    assert!(!serde_json::to_string(&translated).unwrap().contains(SECRET));
    only_in_the_header(&seen.recv().unwrap());
}

#[test]
fn streamed_pieces_and_the_result_never_carry_the_secret() {
    let body = "data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"好\"}}]}\n\ndata: [DONE]\n\n";
    let (endpoint, seen) = engine("200 OK", "text/event-stream", body);
    let pieces = Mutex::new(Vec::new());
    let keep = |piece: String| {
        pieces.lock().unwrap().push(piece);
        true
    };
    let translated = ask(endpoint, Some(&keep)).unwrap();
    assert_eq!(translated.text, "你好");
    assert_eq!(*pieces.lock().unwrap(), ["你", "好"]);
    assert!(!format!("{:?}{}", pieces.lock().unwrap(), serde_json::to_string(&translated).unwrap()).contains(SECRET));
    only_in_the_header(&seen.recv().unwrap());
}

#[test]
fn a_stream_stops_reading_once_the_caller_stops_wanting_pieces() {
    let body = "data: {\"choices\":[{\"delta\":{\"content\":\"一\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"二\"}}]}\n\ndata: [DONE]\n\n";
    let (endpoint, _seen) = engine("200 OK", "text/event-stream", body);
    let pieces = Mutex::new(Vec::new());
    let first_only = |piece: String| {
        pieces.lock().unwrap().push(piece);
        false
    };
    assert_eq!(ask(endpoint, Some(&first_only)).unwrap().text, "一");
    assert_eq!(*pieces.lock().unwrap(), ["一"]);
}

#[test]
fn an_engine_error_keeps_its_code_and_args_for_the_host_but_not_the_secret() {
    let (endpoint, seen) = engine("401 Unauthorized", "application/json", &format!(r#"{{"error":"bad key {SECRET}"}}"#));
    let error = ask(endpoint, None).unwrap_err();
    assert_eq!(error.code(), "translation.status");
    assert!(!serde_json::to_string(&error).unwrap().contains(SECRET));
    let shown = error.into_serve_error();
    assert_eq!(shown.code, "translation.status");
    assert_eq!(shown.data, Some(serde_json::json!({ "args": { "service": "自定义接口", "status": 401 } })));
    assert!(!format!("{} {:?}", shown.message, shown.data).contains(SECRET));
    only_in_the_header(&seen.recv().unwrap());
}

#[test]
fn an_unreachable_engine_says_so_without_the_secret() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let endpoint = Url::parse(&format!("http://{}/chat/completions", listener.local_addr().unwrap())).unwrap();
    drop(listener);
    let error = ask(endpoint, None).unwrap_err();
    assert_eq!(error.code(), "net.unreachable");
    assert!(!shown_to_the_host(error).contains(SECRET));
}

#[test]
fn user_errors_reach_the_host_with_their_own_code_args_and_detail() {
    let plain = UserError::new("translation.empty", "Enter the text to translate.").into_serve_error();
    assert_eq!((plain.code.as_str(), plain.message.as_str(), plain.data), ("translation.empty", "Enter the text to translate.", None));
    let full = UserError::new("translation.unfinished", "DeepSeek did not finish.").arg("service", "DeepSeek").detail("content_filter").into_serve_error();
    assert_eq!(full.data, Some(serde_json::json!({ "args": { "service": "DeepSeek" }, "detail": "content_filter" })));
}

#[test]
fn engines_list_every_engine_with_only_whether_it_has_a_secret() {
    let listed = engines_with(|provider| Ok(provider.id == "deepseek"), || Ok(None)).unwrap();
    let json = serde_json::to_value(&listed).unwrap();
    let engines = json["engines"].as_array().unwrap();
    assert_eq!(engines.len(), 7);
    assert_eq!(engines[0], serde_json::json!({ "engine": "deepseek", "hasSecret": true }));
    assert!(engines.iter().all(|entry| entry.as_object().unwrap().keys().map(String::as_str).eq(["engine", "hasSecret"])));
    assert!(engines[1..].iter().all(|entry| entry["hasSecret"] == false));
    assert_eq!(engines.last().unwrap()["engine"], "custom");
    let none: TranslatorEngines = engines_with(|_| Ok(false), || Ok(Some("https://api.example.com/v1".into()))).unwrap();
    assert!(!none.engines.contains(&EngineSecret { engine: "deepseek", has_secret: true }));
    assert!(!none.engines.contains(&EngineSecret { engine: "custom", has_secret: true }));
    let local: TranslatorEngines = engines_with(|_| Ok(false), || Ok(Some("http://localhost:11434/v1".into()))).unwrap();
    assert!(local.engines.contains(&EngineSecret { engine: "custom", has_secret: true }));
    assert_eq!(engines_with(|_| Err(UserError::new("credential.read", "Could not read.")), || Ok(None)).unwrap_err().code(), "credential.read");
}

#[test]
fn loopback_custom_endpoints_work_without_a_key_and_remote_ones_still_require_it() {
    let custom = find_provider(Some("custom")).unwrap();
    let deepseek = find_provider(Some("deepseek")).unwrap();
    for raw in ["http://localhost:11434/v1", "http://127.0.0.1:8080", "http://[::1]:11434/v1"] {
        let url = completions_url(custom, Some(raw)).unwrap();
        assert_eq!(resolve_secret(custom, &url, |_| Ok(None)).unwrap(), None);
        assert_eq!(resolve_secret(custom, &url, |_| Ok(Some(format!(" {SECRET} ")))).unwrap().as_deref(), Some(SECRET));
    }
    let remote = completions_url(custom, Some("https://api.example.com/v1")).unwrap();
    assert_eq!(resolve_secret(custom, &remote, |_| Ok(None)).unwrap_err().code(), "translation.noKey");
    assert_eq!(resolve_secret(custom, &remote, |_| Ok(Some("   ".into()))).unwrap_err().code(), "translation.noKey");
    assert_eq!(resolve_secret(custom, &remote, |_| Ok(Some(SECRET.into()))).unwrap().as_deref(), Some(SECRET));
    let builtin_loopback = Url::parse("http://127.0.0.1:8080/chat/completions").unwrap();
    assert_eq!(resolve_secret(deepseek, &builtin_loopback, |_| Ok(None)).unwrap_err().code(), "translation.noKey");

    let (endpoint, seen) = engine("200 OK", "application/json", r#"{"choices":[{"message":{"content":"免密译文"},"finish_reason":"stop"}]}"#);
    let translated = ask_without_secret(endpoint).unwrap();
    assert_eq!(translated, Translated { text: "免密译文".into(), engine: "custom" });
    let wire = seen.recv().unwrap();
    assert!(!wire.to_ascii_lowercase().contains("authorization:"), "{wire}");
}

#[test]
fn empty_translation_shortcuts_turn_the_hotkey_off_without_falling_back_to_defaults() {
    assert!(parse_optional_shortcut("").unwrap().is_none());
    assert!(parse_optional_shortcut("   ").unwrap().is_none());
    assert_eq!(parse_optional_shortcut("Ctrl+Shift+F").unwrap().map(|binding| binding.label), Some("Ctrl+Shift+F".into()));
    assert_eq!(parse_optional_shortcut("F").err().unwrap().code(), "shortcut.invalid");

    assert_eq!(WantedBinding::Default.resolve(DEFAULT_SHORTCUT).map(|binding| binding.label), Some("Ctrl+Shift+F".into()));
    assert_eq!(WantedBinding::Default.resolve(DEFAULT_SELECTION_SHORTCUT).map(|binding| binding.label), Some("Ctrl+Alt+T".into()));
    let off = WantedBinding::from_option(None);
    assert!(matches!(off, WantedBinding::Off));
    assert!(off.resolve(DEFAULT_SHORTCUT).is_none());
    assert!(off.resolve(DEFAULT_SELECTION_SHORTCUT).is_none());
    let custom = parse_optional_shortcut("Ctrl+Alt+Q").unwrap();
    assert_eq!(WantedBinding::from_option(custom).resolve(DEFAULT_SHORTCUT).map(|binding| binding.label), Some("Ctrl+Alt+Q".into()));
}

#[test]
fn the_translator_methods_are_registered_for_the_host() {
    let serve = plugin_base::Serve::registered().unwrap();
    for name in ["translator.engines", "translator.rewrite", "translator.translate"] {
        assert!(serve.names().contains(&name), "{name} is missing from {:?}", serve.names());
    }
}

struct Host {
    to_rust: std::io::PipeWriter,
    from_rust: mpsc::Receiver<Value>,
    _rpc: Rpc,
}

impl Host {
    fn start() -> Self {
        let mut serve = Serve::registered().unwrap();
        serve.block_on_with(|future| tauri::async_runtime::block_on(future));
        let (host_reads, rust_writes) = std::io::pipe().unwrap();
        let (rust_reads, to_rust) = std::io::pipe().unwrap();
        let rpc = Rpc::start_serving(rust_reads, rust_writes, Some(Arc::new(serve)), |_, _| {}, |_| {});
        let (sender, from_rust) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(host_reads).lines().map_while(Result::ok) {
                let _ = sender.send(serde_json::from_str(&line).unwrap());
            }
        });
        Self { to_rust, from_rust, _rpc: rpc }
    }

    fn error(&mut self, method: &str, params: Value) -> Value {
        writeln!(self.to_rust, "{}", json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params })).unwrap();
        loop {
            let message = self.from_rust.recv_timeout(Duration::from_secs(10)).unwrap();
            if message["id"] == 1 {
                return message["error"].clone();
            }
        }
    }
}

#[test]
fn the_host_cannot_choose_where_a_secret_goes_and_custom_uses_the_saved_address() {
    let (endpoint, seen) = engine("200 OK", "application/json", r#"{"choices":[{"message":{"content":"hi"},"finish_reason":"stop"}]}"#);
    let mut host = Host::start();
    let address = endpoint.as_str().trim_end_matches("/chat/completions").to_string();
    let calls = [
        ("translator.translate", json!({ "text": "hello", "direction": "auto", "provider": "custom", "baseUrl": address, "model": "m" })),
        ("translator.rewrite", json!({ "text": "hello", "task": "polish", "provider": "custom", "baseUrl": address, "model": "m" })),
    ];
    address::save("").unwrap();
    for (method, params) in &calls {
        let error = host.error(method, params.clone());
        assert_eq!(error["code"], "translation.noAddress", "{method}: {error}");
        assert_eq!(error["data"], json!({ "args": { "service": "自定义接口" } }));
        assert!(!error.to_string().contains(&address) && !error.to_string().contains(SECRET), "{error}");
    }
    address::save("http://api.example.com/v1").unwrap();
    for (method, params) in &calls {
        let error = host.error(method, params.clone());
        assert_eq!(error["code"], "translation.urlScheme", "{method} should check the saved address, not the caller's: {error}");
    }
    address::save("  ").unwrap();
    assert_eq!(address::read().unwrap(), None);
    assert!(seen.recv_timeout(Duration::from_millis(300)).is_err(), "the engine at the caller's address was reached");
    let (declarations, _) = plugin_base::ts::typescript(&plugin_base::ts::described());
    let entries: Vec<&str> = declarations.lines().filter(|line| line.trim_start().starts_with("\"translator.")).collect();
    assert_eq!(entries.len(), 3, "{declarations}");
    assert!(entries.iter().all(|line| !line.contains("baseUrl")), "{entries:?}");
}

#[test]
fn only_the_custom_engine_falls_back_to_the_saved_address() {
    let custom = find_provider(Some("custom")).unwrap();
    let deepseek = find_provider(Some("deepseek")).unwrap();
    let saved = || Ok(Some("https://saved.example/v1".to_owned()));
    let nothing = || Ok(None);
    let never = || -> Result<Option<String>, UserError> { panic!("the saved address should not be read") };
    assert_eq!(address::stored_or(custom, None, saved).unwrap().as_deref(), Some("https://saved.example/v1"));
    assert_eq!(address::stored_or(custom, Some("https://window.example"), never).unwrap().as_deref(), Some("https://window.example"));
    assert_eq!(address::stored_or(deepseek, None, never).unwrap(), None);
    let missing = address::stored_or(custom, None, nothing).unwrap_err();
    assert_eq!(missing.code(), "translation.noAddress");
    assert!(!shown_to_the_host(missing).contains(SECRET));
    let failed = address::stored_or(custom, None, || Err(UserError::new("credential.read", "Could not read."))).unwrap_err();
    assert_eq!(failed.code(), "credential.read");
    assert_eq!(address::save(&format!("https://{}.example", "a".repeat(500))).unwrap_err().code(), "translation.urlLong");
}

#[test]
fn the_shortcuts_and_window_are_the_background_listed_for_translation() {
    let catalog = crate::plugin_kernel::builtins::catalog();
    let translation = catalog.iter().find(|plugin| plugin.id == super::PLUGIN_ID).expect("translation is a built-in plugin");
    let names = [super::background::SHORTCUTS.to_owned(), super::background::WINDOW.to_owned()];
    assert_eq!(translation.background.as_deref(), Some(&names[..]));
}
