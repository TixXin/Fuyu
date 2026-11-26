use std::{
    net::SocketAddr,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Instant,
};

use super::{
    client::{connect, pair, PairError},
    host::{Host, Serve},
    identity::generate,
    pairing::MAX_TRIES,
    peers::Peer,
    server::listen,
    wire::{decode_bytes, reason, Entry, Reply, Request},
};

#[derive(Default)]
struct Shelf {
    clips: Mutex<Vec<(String, serde_json::Value)>>,
}

impl Serve for Shelf {
    fn list(&self, dir: &str) -> Result<Vec<Entry>, String> {
        Ok(vec![Entry { name: format!("{dir}-file.json"), is_dir: false }])
    }

    fn read(&self, path: &str) -> Result<Option<Vec<u8>>, String> {
        Ok((path != "missing").then(|| path.as_bytes().to_vec()))
    }

    fn clip(&self, from: &Peer, item: serde_json::Value) -> Result<(), String> {
        self.clips.lock().unwrap().push((from.device_id.clone(), item));
        Ok(())
    }
}

fn dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-lan-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn host(tag: &str, device: &str, shelf: Arc<Shelf>) -> Arc<Host> {
    Host::new(generate().unwrap(), device.into(), format!("{tag} box"), dir(tag), shelf)
}

fn wrong(code: &str) -> String {
    format!("{:06}", (code.parse::<u32>().unwrap() + 1) % 1_000_000)
}

#[test]
fn pairing_pins_both_certificates_and_then_serves_only_paired_devices() {
    let shelf = Arc::new(Shelf::default());
    let shower = host("shower", "aaa1", shelf.clone());
    let joiner = host("joiner", "bbb2", Arc::new(Shelf::default()));
    let stranger = host("stranger", "ccc3", Arc::new(Shelf::default()));
    let listener = listen(shower.clone(), 0).unwrap();
    let addr = SocketAddr::from(([127, 0, 0, 1], listener.port()));
    let list = Request::List { dir: "devices".into() };

    assert!(connect(&joiner.identity, addr, &shower.identity.fingerprint).and_then(|mut session| session.call(&list)).is_err());
    assert!(pair(&joiner, addr, "123456").is_err());

    let (code, seconds) = shower.open_pairing(Instant::now()).unwrap();
    assert!(seconds > 100);
    assert_eq!(pair(&joiner, addr, &wrong(&code)), Err(PairError::WrongCode));
    let peer = pair(&joiner, addr, &code).unwrap();
    assert_eq!((peer.fingerprint.as_str(), peer.device_id.as_str(), peer.name.as_str()), (shower.identity.fingerprint.as_str(), "aaa1", "shower box"));
    assert_eq!(shower.peers().iter().map(|peer| peer.fingerprint.as_str()).collect::<Vec<_>>(), [joiner.identity.fingerprint.as_str()]);
    assert!(shower.pairing(Instant::now()).is_none());

    let mut session = connect(&joiner.identity, addr, &shower.identity.fingerprint).unwrap();
    assert_eq!(session.call(&list).unwrap(), Reply::Entries { entries: vec![Entry { name: "devices-file.json".into(), is_dir: false }] });
    match session.call(&Request::Read { path: "a/b.json".into() }).unwrap() {
        Reply::Data { bytes: Some(bytes) } => assert_eq!(decode_bytes(&bytes).unwrap(), b"a/b.json"),
        other => panic!("{other:?}"),
    }
    assert_eq!(session.call(&Request::Read { path: "missing".into() }).unwrap(), Reply::Data { bytes: None });
    assert_eq!(session.call(&Request::PushClip { item: serde_json::json!({ "text": "hi" }) }).unwrap(), Reply::Done);
    assert_eq!(shelf.clips.lock().unwrap().as_slice(), [("bbb2".to_string(), serde_json::json!({ "text": "hi" }))]);
    assert_eq!(session.call(&Request::PairConfirm { tag: String::new() }).unwrap(), Reply::Refused { reason: reason::BAD_REQUEST.into() });

    assert!(connect(&joiner.identity, addr, &stranger.identity.fingerprint).is_err());
    assert!(connect(&stranger.identity, addr, &shower.identity.fingerprint).and_then(|mut session| session.call(&list)).is_err());
    assert!(shower.remove_peer(&joiner.identity.fingerprint).unwrap());
    assert!(connect(&joiner.identity, addr, &shower.identity.fingerprint).and_then(|mut session| session.call(&list)).is_err());
}

#[test]
fn a_pairing_code_stops_working_after_too_many_wrong_tries() {
    let shower = host("tries-shower", "ddd4", Arc::new(Shelf::default()));
    let joiner = host("tries-joiner", "eee5", Arc::new(Shelf::default()));
    let listener = listen(shower.clone(), 0).unwrap();
    let addr = SocketAddr::from(([127, 0, 0, 1], listener.port()));
    let (code, _) = shower.open_pairing(Instant::now()).unwrap();
    for _ in 0..MAX_TRIES {
        assert_eq!(pair(&joiner, addr, &wrong(&code)), Err(PairError::WrongCode));
    }
    assert_eq!(pair(&joiner, addr, &code), Err(PairError::Refused(reason::TOO_MANY_TRIES.into())));
    assert!(shower.peers().is_empty());
    assert!(joiner.peers().is_empty());
}

#[test]
fn the_lan_backend_writes_only_its_own_files_and_reads_peers_from_the_cache() {
    use super::store::{LanBackend, StoreServe};
    use crate::sync::backend::Backend;
    let home_a = dir("store-a");
    let home_b = dir("store-b");
    let woke = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let counter = woke.clone();
    let wake: Arc<dyn Fn() + Send + Sync> = Arc::new(move || {
        counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    });
    let a = Host::new(generate().unwrap(), "aaa1".into(), "A".into(), home_a.clone(), Arc::new(StoreServe::new(&home_a, "aaa1", wake.clone())));
    let b = Host::new(generate().unwrap(), "bbb2".into(), "B".into(), home_b.clone(), Arc::new(StoreServe::new(&home_b, "bbb2", wake)));
    let listener = listen(a.clone(), 0).unwrap();
    let addr = SocketAddr::from(([127, 0, 0, 1], listener.port()));
    let (code, _) = a.open_pairing(Instant::now()).unwrap();
    pair(&b, addr, &code).unwrap();
    assert_eq!(woke.load(std::sync::atomic::Ordering::SeqCst), 1);

    let backend_a = LanBackend::new(&home_a, "aaa1", None);
    backend_a.check().unwrap();
    backend_a.write("fuyu-sync/devices/aaa1/todos.json", b"{\"a\":1}").unwrap();
    backend_a.write("fuyu-sync/devices/aaa1/stale.json", b"old").unwrap();
    assert!(backend_a.wrote());
    assert!(backend_a.write("fuyu-sync/devices/bbb2/todos.json", b"x").is_err());
    assert!(backend_a.delete("fuyu-sync/devices/bbb2/todos.json").is_err());
    let serve_a = StoreServe::new(&home_a, "aaa1", Arc::new(|| {}));
    assert!(serve_a.read("fuyu-sync/meta.json").is_err());
    assert!(serve_a.list("fuyu-sync/devices").is_err());

    let backend_b = LanBackend::new(&home_b, "bbb2", Some(b.clone()));
    backend_b.check().unwrap();
    assert_eq!(backend_b.read("fuyu-sync/devices/aaa1/todos.json").unwrap().as_deref(), Some(&b"{\"a\":1}"[..]));
    backend_b.write("fuyu-sync/devices/bbb2/todos.json", b"{}").unwrap();
    let names = |backend: &LanBackend| backend.list("fuyu-sync/devices").unwrap().into_iter().map(|listed| listed.name).collect::<Vec<_>>();
    assert_eq!(names(&backend_b), ["aaa1", "bbb2"]);

    backend_a.delete("fuyu-sync/devices/aaa1/stale.json").unwrap();
    backend_b.check().unwrap();
    assert_eq!(backend_b.read("fuyu-sync/devices/aaa1/stale.json").unwrap(), None);
    assert!(backend_b.read("fuyu-sync/devices/aaa1/todos.json").unwrap().is_some());

    b.remove_peer(&a.identity.fingerprint).unwrap();
    assert_eq!(names(&backend_b), ["bbb2"]);
    super::store::forget_cache(&home_b, "aaa1");
    assert!(!home_b.join("sync-lan-cache/fuyu-sync/devices/aaa1").exists());
}

#[test]
fn a_saved_lan_choice_stays_active_without_a_folder_or_webdav() {
    use crate::sync::config::{SyncBackendKind, SyncConfig};
    let config: SyncConfig = serde_json::from_str(r#"{"version":1,"backend":"lan","categories":["todos"]}"#).unwrap();
    let config = config.normalized();
    assert_eq!(config.active_backend(), SyncBackendKind::Lan);
    assert_eq!(config.target_key().as_deref(), Some("lan"));
    assert!(crate::sync::LOCAL_FILES.contains(&"sync-lan-peers.json"));
}
