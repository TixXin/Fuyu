use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{Arc, Mutex, MutexGuard, PoisonError},
    time::Instant,
};

use super::{
    identity::Identity,
    pairing::{new_code, Refusal, Window},
    peers::{self, Peer, Saved},
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
    saved: Mutex<Saved>,
    pairing: Mutex<Option<Window>>,
    nearby: Mutex<BTreeMap<String, Nearby>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Nearby {
    pub(crate) name: String,
    pub(crate) address: String,
}

fn locked<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

impl Host {
    pub(crate) fn new(identity: Identity, device_id: String, name: String, peers_dir: PathBuf, serve: Arc<dyn Serve>) -> Arc<Self> {
        let saved = peers::load(&peers_dir);
        Arc::new(Self {
            identity,
            device_id,
            name: peers::clean_name(&name),
            serve,
            peers_dir,
            saved: Mutex::new(saved),
            pairing: Mutex::new(None),
            nearby: Mutex::new(BTreeMap::new()),
        })
    }

    fn change(&self, edit: impl FnOnce(&mut Saved) -> bool) -> Result<bool, String> {
        let mut saved = locked(&self.saved);
        let mut next = saved.clone();
        if !edit(&mut next) {
            return Ok(false);
        }
        peers::save(&self.peers_dir, &next)?;
        *saved = next;
        Ok(true)
    }

    pub(crate) fn peers(&self) -> Vec<Peer> {
        locked(&self.saved).peers.clone()
    }

    pub(crate) fn peer(&self, fingerprint: &str) -> Option<Peer> {
        locked(&self.saved).peers.iter().find(|peer| peer.fingerprint == fingerprint).cloned()
    }

    pub(crate) fn clip_push(&self) -> bool {
        locked(&self.saved).clip_push
    }

    pub(crate) fn set_clip_push(&self, on: bool) -> Result<(), String> {
        self.change(|saved| std::mem::replace(&mut saved.clip_push, on) != on).map(|_| ())
    }

    pub(crate) fn add_peer(&self, peer: Peer) -> Result<(), String> {
        locked(&self.nearby).remove(&peer.device_id);
        self.change(|saved| {
            peers::upsert(&mut saved.peers, peer);
            true
        })
        .map(|_| ())
    }

    pub(crate) fn remove_peer(&self, fingerprint: &str) -> Result<bool, String> {
        self.change(|saved| {
            let before = saved.peers.len();
            saved.peers.retain(|peer| peer.fingerprint != fingerprint);
            saved.peers.len() != before
        })
    }

    pub(crate) fn remember_device(&self, device_id: &str, name: &str, address: &str) -> bool {
        let fingerprint = locked(&self.saved).peers.iter().find(|peer| peer.device_id == device_id).map(|peer| peer.fingerprint.clone());
        let Some(fingerprint) = fingerprint else {
            locked(&self.nearby).insert(device_id.to_string(), Nearby { name: peers::clean_name(name), address: address.to_string() });
            return false;
        };
        let _ = self.change(|saved| peers::remember_address(&mut saved.peers, &fingerprint, address));
        true
    }

    pub(crate) fn forget_nearby(&self, device_id: &str) {
        locked(&self.nearby).remove(device_id);
    }

    pub(crate) fn nearby(&self) -> Vec<(String, Nearby)> {
        locked(&self.nearby).iter().map(|(id, found)| (id.clone(), found.clone())).collect()
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
        locked(&self.saved).peers.iter().any(|peer| peer.fingerprint == fingerprint) || locked(&self.pairing).is_some()
    }
}
