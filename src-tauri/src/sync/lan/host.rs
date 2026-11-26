use std::{
    path::PathBuf,
    sync::{Arc, Mutex, MutexGuard, PoisonError},
    time::Instant,
};

use super::{
    identity::Identity,
    pairing::{new_code, Refusal, Window},
    peers::{self, Peer},
    wire::{reason, Entry},
};

pub(crate) trait Serve: Send + Sync {
    fn list(&self, dir: &str) -> Result<Vec<Entry>, String>;
    fn read(&self, path: &str) -> Result<Option<Vec<u8>>, String>;
    fn clip(&self, from: &Peer, item: serde_json::Value) -> Result<(), String>;
    fn paired(&self, _peer: &Peer) {}
    fn poke(&self) {}
}

pub(crate) struct Host {
    pub(crate) identity: Identity,
    pub(crate) device_id: String,
    pub(crate) name: String,
    pub(crate) serve: Arc<dyn Serve>,
    peers_dir: PathBuf,
    peers: Mutex<Vec<Peer>>,
    pairing: Mutex<Option<Window>>,
}

fn locked<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

impl Host {
    pub(crate) fn new(identity: Identity, device_id: String, name: String, peers_dir: PathBuf, serve: Arc<dyn Serve>) -> Arc<Self> {
        let peers = peers::load(&peers_dir);
        Arc::new(Self { identity, device_id, name: peers::clean_name(&name), serve, peers_dir, peers: Mutex::new(peers), pairing: Mutex::new(None) })
    }

    pub(crate) fn peers(&self) -> Vec<Peer> {
        locked(&self.peers).clone()
    }

    pub(crate) fn peer(&self, fingerprint: &str) -> Option<Peer> {
        locked(&self.peers).iter().find(|peer| peer.fingerprint == fingerprint).cloned()
    }

    pub(crate) fn add_peer(&self, peer: Peer) -> Result<(), String> {
        let mut peers = locked(&self.peers);
        let mut next = peers.clone();
        peers::upsert(&mut next, peer);
        peers::save(&self.peers_dir, &next)?;
        *peers = next;
        Ok(())
    }

    pub(crate) fn remove_peer(&self, fingerprint: &str) -> Result<bool, String> {
        let mut peers = locked(&self.peers);
        let next: Vec<Peer> = peers.iter().filter(|peer| peer.fingerprint != fingerprint).cloned().collect();
        if next.len() == peers.len() {
            return Ok(false);
        }
        peers::save(&self.peers_dir, &next)?;
        *peers = next;
        Ok(true)
    }

    pub(crate) fn remember_address(&self, fingerprint: &str, address: &str) {
        let mut peers = locked(&self.peers);
        if peers::remember_address(&mut peers, fingerprint, address) {
            let _ = peers::save(&self.peers_dir, &peers);
        }
    }

    pub(crate) fn remember_device(&self, device_id: &str, address: &str) -> bool {
        let mut peers = locked(&self.peers);
        let Some(fingerprint) = peers.iter().find(|peer| peer.device_id == device_id).map(|peer| peer.fingerprint.clone()) else {
            return false;
        };
        if peers::remember_address(&mut peers, &fingerprint, address) {
            let _ = peers::save(&self.peers_dir, &peers);
        }
        true
    }

    pub(crate) fn open_pairing(&self, now: Instant) -> Result<(String, u64), String> {
        let window = Window::open(new_code()?, now);
        let shown = (window.code().to_string(), window.seconds_left(now));
        *locked(&self.pairing) = Some(window);
        Ok(shown)
    }

    pub(crate) fn close_pairing(&self) {
        *locked(&self.pairing) = None;
    }

    pub(crate) fn pairing(&self, now: Instant) -> Option<(String, u64)> {
        let mut slot = locked(&self.pairing);
        match slot.as_ref() {
            Some(window) if window.seconds_left(now) > 0 && !window.spent() => Some((window.code().to_string(), window.seconds_left(now))),
            Some(_) => {
                *slot = None;
                None
            }
            None => None,
        }
    }

    pub(crate) fn admit(&self, now: Instant) -> Result<String, &'static str> {
        match locked(&self.pairing).as_mut() {
            None => Err(reason::NOT_PAIRING),
            Some(window) => window.admit(now).map_err(|refusal| match refusal {
                Refusal::Expired => reason::EXPIRED,
                Refusal::TooManyTries => reason::TOO_MANY_TRIES,
            }),
        }
    }

    pub(crate) fn admits(&self, fingerprint: &str) -> bool {
        locked(&self.peers).iter().any(|peer| peer.fingerprint == fingerprint) || locked(&self.pairing).is_some()
    }
}
