use std::{
    fs,
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
};

use crate::sync::{
    backend::{is_safe_path, Backend, BackendError, Listed},
    backend_folder::FolderBackend,
    layout::{DEVICES_DIR, META_FILE},
};

use super::{
    client::connect,
    host::{Host, Serve},
    identity::Identity,
    peers::Peer,
    wire::{decode_bytes, Entry, Reply, Request},
};

pub(crate) const STORE_DIR: &str = "sync-lan";
pub(crate) const CACHE_DIR: &str = "sync-lan-cache";

fn own_dir(me: &str) -> String {
    format!("{DEVICES_DIR}/{me}")
}

fn is_under(path: &str, dir: &str) -> bool {
    path == dir || path.strip_prefix(dir).is_some_and(|rest| rest.starts_with('/'))
}

pub(crate) struct LanBackend {
    me: String,
    own_root: PathBuf,
    cache_root: PathBuf,
    own: FolderBackend,
    cache: FolderBackend,
    host: Option<Arc<Host>>,
    wrote: AtomicBool,
}

impl LanBackend {
    pub(crate) fn new(home: &Path, me: &str, host: Option<Arc<Host>>) -> Self {
        let (own_root, cache_root) = (home.join(STORE_DIR), home.join(CACHE_DIR));
        Self { me: me.to_string(), own: FolderBackend::new(own_root.clone()), cache: FolderBackend::new(cache_root.clone()), own_root, cache_root, host, wrote: AtomicBool::new(false) }
    }

    fn is_own(&self, path: &str) -> bool {
        path == META_FILE || is_under(path, &own_dir(&self.me)) || !is_under(path, DEVICES_DIR)
    }

    fn paired_devices(&self) -> Option<Vec<String>> {
        self.host.as_ref().map(|host| host.peers().into_iter().map(|peer| peer.device_id).collect())
    }

    pub(crate) fn wrote(&self) -> bool {
        self.wrote.load(Ordering::SeqCst)
    }

    pub(crate) fn poke_peers(&self) {
        let Some(host) = self.host.clone() else { return };
        let _ = thread::Builder::new().name("fuyu-lan-poke".into()).spawn(move || {
            for peer in host.peers() {
                if let Some(addr) = peer.address.as_deref().and_then(|text| text.parse::<SocketAddr>().ok()) {
                    let _ = connect(&host.identity, addr, &peer.fingerprint).and_then(|mut session| session.call(&Request::Poke));
                }
            }
        });
    }
}

fn fetch(identity: &Identity, peer: &Peer, cache: &FolderBackend) -> Result<(), String> {
    let addr: SocketAddr = peer.address.as_deref().ok_or("no address")?.parse().map_err(|error| format!("{error}"))?;
    let mut session = connect(identity, addr, &peer.fingerprint).map_err(|error| error.to_string())?;
    let dir = own_dir(&peer.device_id);
    let Reply::Entries { entries } = session.call(&Request::List { dir: dir.clone() }).map_err(|error| error.to_string())? else {
        return Err("unexpected answer".into());
    };
    let mut kept = Vec::new();
    for entry in entries.into_iter().filter(|entry| !entry.is_dir && is_safe_path(&entry.name) && !entry.name.contains('/')) {
        let path = format!("{dir}/{}", entry.name);
        match session.call(&Request::Read { path: path.clone() }).map_err(|error| error.to_string())? {
            Reply::Data { bytes: Some(text) } => {
                let bytes = decode_bytes(&text).ok_or("bad bytes")?;
                cache.write(&path, &bytes).map_err(|error| error.message().to_string())?;
                kept.push(entry.name);
            }
            Reply::Data { bytes: None } => {}
            _ => return Err("unexpected answer".into()),
        }
    }
    for gone in cache.list(&dir).unwrap_or_default().into_iter().filter(|listed| !listed.is_dir && !kept.contains(&listed.name)) {
        let _ = cache.delete(&format!("{dir}/{}", gone.name));
    }
    Ok(())
}

pub(crate) fn forget_cache(home: &Path, device_id: &str) {
    if crate::sync::device::is_valid_id(device_id) {
        let _ = fs::remove_dir_all(own_dir(device_id).split('/').fold(home.join(CACHE_DIR), |full, part| full.join(part)));
    }
}

impl Backend for LanBackend {
    fn check(&self) -> Result<(), BackendError> {
        for root in [&self.own_root, &self.cache_root] {
            fs::create_dir_all(root).map_err(|error| BackendError::Unavailable(format!("{}: {error}", root.display())))?;
        }
        if let Some(host) = &self.host {
            for peer in host.peers() {
                let _ = fetch(&host.identity, &peer, &self.cache);
            }
        }
        Ok(())
    }

    fn list(&self, dir: &str) -> Result<Vec<Listed>, BackendError> {
        if dir != DEVICES_DIR {
            return if self.is_own(dir) { self.own.list(dir) } else { self.cache.list(dir) };
        }
        let paired = self.paired_devices();
        let mut listed = self.own.list(dir)?.into_iter().filter(|listed| listed.name == self.me).collect::<Vec<_>>();
        for cached in self.cache.list(dir)? {
            let wanted = cached.name != self.me && paired.as_ref().is_none_or(|paired| paired.contains(&cached.name));
            if wanted && !listed.iter().any(|kept| kept.name == cached.name) {
                listed.push(cached);
            }
        }
        listed.sort_by(|left, right| left.name.cmp(&right.name));
        Ok(listed)
    }

    fn read(&self, path: &str) -> Result<Option<Vec<u8>>, BackendError> {
        if self.is_own(path) {
            self.own.read(path)
        } else {
            self.cache.read(path)
        }
    }

    fn write(&self, path: &str, bytes: &[u8]) -> Result<(), BackendError> {
        if !self.is_own(path) {
            return Err(BackendError::Failed(format!("\"{path}\" belongs to another device.")));
        }
        self.own.write(path, bytes)?;
        if path != META_FILE && !path.ends_with("/device.json") {
            self.wrote.store(true, Ordering::SeqCst);
        }
        Ok(())
    }

    fn delete(&self, path: &str) -> Result<(), BackendError> {
        if !self.is_own(path) {
            return Err(BackendError::Failed(format!("\"{path}\" belongs to another device.")));
        }
        self.own.delete(path)
    }
}

pub(crate) struct StoreServe {
    me: String,
    own: FolderBackend,
    wake: Arc<dyn Fn() + Send + Sync>,
}

impl StoreServe {
    pub(crate) fn new(home: &Path, me: &str, wake: Arc<dyn Fn() + Send + Sync>) -> Self {
        Self { me: me.to_string(), own: FolderBackend::new(home.join(STORE_DIR)), wake }
    }
}

impl Serve for StoreServe {
    fn list(&self, dir: &str) -> Result<Vec<Entry>, String> {
        if dir != own_dir(&self.me) {
            return Err("not shared".into());
        }
        let listed = self.own.list(dir).map_err(|error| error.message().to_string())?;
        Ok(listed.into_iter().map(|listed| Entry { name: listed.name, is_dir: listed.is_dir }).collect())
    }

    fn read(&self, path: &str) -> Result<Option<Vec<u8>>, String> {
        if !is_safe_path(path) || !is_under(path, &own_dir(&self.me)) || path == own_dir(&self.me) {
            return Err("not shared".into());
        }
        self.own.read(path).map_err(|error| error.message().to_string())
    }

    fn clip(&self, from: &Peer, item: serde_json::Value) -> Result<(), String> {
        super::clip::receive(from, &item)
    }

    fn paired(&self, _peer: &Peer) {
        (self.wake)();
    }

    fn poke(&self) {
        (self.wake)();
    }
}
