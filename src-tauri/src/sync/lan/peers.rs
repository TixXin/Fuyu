use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

use super::identity::is_fingerprint;

pub(crate) const FILE_NAME: &str = "sync-lan-peers.json";
const VERSION: u32 = 1;
const MAX_NAME: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Peer {
    pub(crate) fingerprint: String,
    pub(crate) device_id: String,
    #[serde(default)]
    pub(crate) name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) address: Option<String>,
    #[serde(default)]
    pub(crate) paired_at: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PeersFile {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    peers: Vec<Peer>,
}

pub(crate) fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
}

pub(crate) fn clean_name(name: &str) -> String {
    name.chars().filter(|ch| !ch.is_control()).take(MAX_NAME).collect::<String>().trim().to_string()
}

fn usable(peer: &Peer) -> bool {
    is_fingerprint(&peer.fingerprint) && crate::sync::device::is_valid_id(&peer.device_id)
}

pub(crate) fn load(dir: &Path) -> Vec<Peer> {
    let Ok(text) = fs::read_to_string(dir.join(FILE_NAME)) else {
        return Vec::new();
    };
    let Ok(file) = serde_json::from_str::<PeersFile>(text.trim_start_matches('\u{feff}')) else {
        return Vec::new();
    };
    let mut peers: Vec<Peer> = Vec::new();
    for mut peer in file.peers.into_iter().filter(usable) {
        peer.name = clean_name(&peer.name);
        if !peers.iter().any(|kept| kept.fingerprint == peer.fingerprint) {
            peers.push(peer);
        }
    }
    peers
}

pub(crate) fn save(dir: &Path, peers: &[Peer]) -> Result<(), String> {
    let file = PeersFile { version: VERSION, peers: peers.to_vec() };
    let text = serde_json::to_string_pretty(&file).map_err(|error| format!("Could not encode the paired devices: {error}"))?;
    fs::create_dir_all(dir).map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
    let path = dir.join(FILE_NAME);
    crate::fs_write::replace_file(&path, text.as_bytes()).map_err(|error| format!("Could not write {}: {error}", path.display()))
}

pub(crate) fn upsert(peers: &mut Vec<Peer>, peer: Peer) {
    peers.retain(|kept| kept.fingerprint != peer.fingerprint && kept.device_id != peer.device_id);
    peers.push(peer);
}

pub(crate) fn remember_address(peers: &mut [Peer], fingerprint: &str, address: &str) -> bool {
    match peers.iter_mut().find(|peer| peer.fingerprint == fingerprint) {
        Some(peer) if peer.address.as_deref() != Some(address) => {
            peer.address = Some(address.to_string());
            true
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn peer(fp: char, device: &str) -> Peer {
        Peer { fingerprint: fp.to_string().repeat(64), device_id: device.into(), name: "Mac\u{7}  ".into(), address: None, paired_at: 1 }
    }

    #[test]
    fn peers_round_trip_and_drop_broken_or_duplicate_rows() {
        let dir = std::env::temp_dir().join(format!("fuyu-lan-peers-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        assert!(load(&dir).is_empty());
        let mut peers = vec![peer('a', "d1")];
        upsert(&mut peers, peer('b', "d2"));
        upsert(&mut peers, peer('c', "d1"));
        assert_eq!(peers.iter().map(|p| p.device_id.as_str()).collect::<Vec<_>>(), ["d2", "d1"]);
        assert!(remember_address(&mut peers, &"b".repeat(64), "192.168.1.5:47321"));
        assert!(!remember_address(&mut peers, &"b".repeat(64), "192.168.1.5:47321"));
        let mut broken = peers.clone();
        broken.push(Peer { fingerprint: "zz".into(), ..peer('d', "d3") });
        broken.push(peer('b', "d4"));
        save(&dir, &broken).unwrap();
        let back = load(&dir);
        assert_eq!(back.len(), 2);
        assert_eq!(back[0].name, "Mac");
        assert_eq!(back[0].address.as_deref(), Some("192.168.1.5:47321"));
        fs::write(dir.join(FILE_NAME), "{oops").unwrap();
        assert!(load(&dir).is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
