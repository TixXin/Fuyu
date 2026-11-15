use super::provider::find_provider;
use super::request::{request, Translated};
use super::{engines_with, EngineSecret, TranslatorEngines};
use crate::user_error::UserError;
use plugin_base::ServiceFailure;
use reqwest::Url;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::sync::{mpsc, Mutex};
use std::thread;

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
    tauri::async_runtime::block_on(request(provider, endpoint, "test-model", SECRET, "Translate.", "hello", pieces))
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
    let listed = engines_with(|provider| Ok(provider.id == "deepseek")).unwrap();
    let json = serde_json::to_value(&listed).unwrap();
    let engines = json["engines"].as_array().unwrap();
    assert_eq!(engines.len(), 7);
    assert_eq!(engines[0], serde_json::json!({ "engine": "deepseek", "hasSecret": true }));
    assert!(engines.iter().all(|entry| entry.as_object().unwrap().keys().map(String::as_str).eq(["engine", "hasSecret"])));
    assert!(engines[1..].iter().all(|entry| entry["hasSecret"] == false));
    assert_eq!(engines.last().unwrap()["engine"], "custom");
    let none: TranslatorEngines = engines_with(|_| Ok(false)).unwrap();
    assert!(!none.engines.contains(&EngineSecret { engine: "deepseek", has_secret: true }));
    assert_eq!(engines_with(|_| Err(UserError::new("credential.read", "Could not read."))).unwrap_err().code(), "credential.read");
}

#[test]
fn the_translator_methods_are_registered_for_the_host() {
    let serve = plugin_base::Serve::registered().unwrap();
    for name in ["translator.engines", "translator.rewrite", "translator.translate"] {
        assert!(serve.names().contains(&name), "{name} is missing from {:?}", serve.names());
    }
}
