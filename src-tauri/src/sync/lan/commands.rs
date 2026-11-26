use serde::Serialize;
use std::{
    net::{IpAddr, SocketAddr},
    time::Instant,
};

use crate::user_error::UserError;

use super::{
    client::{pair, PairError},
    identity::short,
    runtime::{self, Running},
    server::DEFAULT_PORT,
    store::forget_cache,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanPeer {
    pub fingerprint: String,
    pub short_id: String,
    pub device_id: String,
    pub name: String,
    pub address: Option<String>,
    pub paired_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanNearby {
    pub device_id: String,
    pub name: String,
    pub address: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanPairing {
    pub code: String,
    pub seconds_left: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanState {
    pub running: bool,
    pub port: Option<u16>,
    pub announced: bool,
    pub short_id: Option<String>,
    pub peers: Vec<LanPeer>,
    pub nearby: Vec<LanNearby>,
    pub pairing: Option<LanPairing>,
    pub clip_push: bool,
}

fn lan_off() -> UserError {
    UserError::new("sync.lanOff", "Turn on the local network link first.")
}

fn running() -> Result<Running, UserError> {
    runtime::running().ok_or_else(lan_off)
}

pub(crate) fn state() -> LanState {
    let Some(Running { host, port, announced }) = runtime::running() else {
        return LanState::default();
    };
    let peers = host
        .peers()
        .into_iter()
        .map(|peer| LanPeer { short_id: short(&peer.fingerprint), fingerprint: peer.fingerprint, device_id: peer.device_id, name: peer.name, address: peer.address, paired_at: peer.paired_at })
        .collect();
    let nearby = host.nearby().into_iter().map(|(device_id, found)| LanNearby { device_id, name: found.name, address: found.address }).collect();
    LanState {
        running: true,
        port: Some(port),
        announced,
        short_id: Some(short(&host.identity.fingerprint)),
        peers,
        nearby,
        pairing: host.pairing(Instant::now()).map(|(code, seconds_left)| LanPairing { code, seconds_left }),
        clip_push: host.clip_push(),
    }
}

pub(crate) fn parse_address(text: &str) -> Option<SocketAddr> {
    let text = text.trim();
    text.parse::<SocketAddr>().ok().or_else(|| text.trim_start_matches('[').trim_end_matches(']').parse::<IpAddr>().ok().map(|ip| SocketAddr::new(ip, DEFAULT_PORT)))
}

pub(crate) fn start_pairing() -> Result<LanPairing, UserError> {
    let (code, seconds_left) = running()?.host.open_pairing(Instant::now()).map_err(UserError::from)?;
    Ok(LanPairing { code, seconds_left })
}

pub(crate) fn cancel_pairing() -> LanState {
    if let Some(host) = runtime::host() {
        host.close_pairing();
    }
    state()
}

pub(crate) fn join(address: &str, code: &str) -> Result<LanState, UserError> {
    let host = running()?.host;
    let addr = parse_address(address).ok_or_else(|| UserError::new("sync.lanBadAddress", "Enter an address like 192.168.1.20 or 192.168.1.20:47321.").arg("address", address.trim().to_string()))?;
    let code = code.trim();
    if !super::pairing::is_code(code) {
        return Err(UserError::new("sync.lanWrongCode", "The pairing code does not match. Check the 6 digits on the other device."));
    }
    match pair(&host, addr, code) {
        Ok(peer) => {
            host.serve.paired(&peer);
            Ok(state())
        }
        Err(PairError::WrongCode) => Err(UserError::new("sync.lanWrongCode", "The pairing code does not match. Check the 6 digits on the other device.")),
        Err(PairError::Unreachable(detail)) => Err(UserError::new("sync.lanUnreachable", "Could not reach that device. Check that both are on the same network and the firewall allows Fuyu.").detail(detail)),
        Err(PairError::Refused(_)) => Err(UserError::new("sync.lanCodeExpired", "That device is not showing a pairing code, or the code has expired. Show a new code and try again.")),
        Err(PairError::Broken(detail)) => Err(UserError::new("sync.lanPairFailed", "Pairing did not finish. Try again.").detail(detail)),
    }
}

pub(crate) fn remove_peer(home: &std::path::Path, fingerprint: &str) -> Result<LanState, UserError> {
    let host = running()?.host;
    let device = host.peer(fingerprint).map(|peer| peer.device_id);
    host.remove_peer(fingerprint).map_err(UserError::from)?;
    if let Some(device) = device {
        forget_cache(home, &device);
    }
    Ok(state())
}

pub(crate) fn set_clip_push(enabled: bool) -> Result<LanState, UserError> {
    running()?.host.set_clip_push(enabled).map_err(UserError::from)?;
    Ok(state())
}
