use serde_json::{json, Value};
use std::{net::SocketAddr, thread};

use super::{client::connect, peers::Peer, runtime, wire::Request};

pub(crate) const MAX_TEXT_BYTES: usize = 1024 * 1024;

pub(crate) fn wanted(text: &str) -> bool {
    !text.trim().is_empty() && text.len() <= MAX_TEXT_BYTES
}

pub(crate) fn offer(text: &str) {
    let Some(host) = runtime::host() else { return };
    if !host.clip_push() || !wanted(text) {
        return;
    }
    let targets: Vec<(Peer, SocketAddr)> =
        host.peers().into_iter().filter_map(|peer| peer.address.as_deref().and_then(|text| text.parse().ok()).map(|addr| (peer, addr))).collect();
    if targets.is_empty() {
        return;
    }
    let request = Request::PushClip { item: json!({ "text": text }) };
    let _ = thread::Builder::new().name("fuyu-lan-clip".into()).spawn(move || {
        for (peer, addr) in targets {
            let _ = connect(&host.identity, addr, &peer.fingerprint).and_then(|mut session| session.call(&request));
        }
    });
}

pub(crate) fn text_of(item: &Value) -> Option<&str> {
    item.get("text").and_then(Value::as_str).filter(|text| wanted(text))
}

pub(crate) fn receive(from: &Peer, item: &Value) -> Result<(), String> {
    let text = text_of(item).ok_or("not a text clip")?;
    crate::clipboard_history::actions::add_from_device(text.to_string(), &from.name)
}
