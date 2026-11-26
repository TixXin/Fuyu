use rustls::{pki_types::ServerName, ClientConnection, StreamOwned};
use std::{
    io,
    net::{SocketAddr, TcpStream},
    sync::Arc,
    time::Duration,
};

use super::{
    host::Host,
    identity::Identity,
    pairing::{self, Binding, Role},
    peers::{clean_name, now_ms, Peer},
    server::prepare,
    tls::{client_config, peer_fingerprint, Pins, SERVER_NAME},
    wire::{decode_bytes, encode_bytes, read_frame, reason, write_frame, Reply, Request},
};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

pub(crate) struct Session {
    tls: StreamOwned<ClientConnection, TcpStream>,
    pub(crate) fingerprint: String,
}

fn open(identity: &Identity, addr: SocketAddr, pins: Pins) -> io::Result<Session> {
    let stream = TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT)?;
    prepare(&stream)?;
    let config = client_config(identity, pins).map_err(io::Error::other)?;
    let name = ServerName::try_from(SERVER_NAME).map_err(io::Error::other)?;
    let mut tls = StreamOwned::new(ClientConnection::new(config, name).map_err(io::Error::other)?, stream);
    while tls.conn.is_handshaking() {
        tls.conn.complete_io(&mut tls.sock)?;
    }
    let fingerprint = peer_fingerprint(&tls.conn).ok_or_else(|| io::Error::other("The other device sent no certificate."))?;
    Ok(Session { tls, fingerprint })
}

pub(crate) fn connect(identity: &Identity, addr: SocketAddr, expected: &str) -> io::Result<Session> {
    let expected = expected.to_string();
    open(identity, addr, Arc::new(move |fingerprint: &str| fingerprint == expected))
}

impl Session {
    pub(crate) fn call(&mut self, request: &Request) -> io::Result<Reply> {
        write_frame(&mut self.tls, request)?;
        read_frame(&mut self.tls)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PairError {
    Unreachable(String),
    WrongCode,
    Refused(String),
    Broken(String),
}

fn refused(why: String) -> PairError {
    if why == reason::WRONG_CODE {
        PairError::WrongCode
    } else {
        PairError::Refused(why)
    }
}

fn broken(error: io::Error) -> PairError {
    PairError::Broken(error.to_string())
}

pub(crate) fn pair(host: &Host, addr: SocketAddr, code: &str) -> Result<Peer, PairError> {
    let mut session = open(&host.identity, addr, Arc::new(|_: &str| true)).map_err(|error| PairError::Unreachable(error.to_string()))?;
    let (exchange, outbound) = pairing::start(code);
    let start = Request::PairStart { device_id: host.device_id.clone(), name: host.name.clone(), spake: encode_bytes(&outbound) };
    let (device_id, name, spake, tag) = match session.call(&start).map_err(broken)? {
        Reply::PairAnswer { device_id, name, spake, tag } => (device_id, name, spake, tag),
        Reply::Refused { reason } => return Err(refused(reason)),
        other => return Err(PairError::Broken(format!("{other:?}"))),
    };
    if !crate::sync::device::is_valid_id(&device_id) {
        return Err(PairError::Broken("bad device id".into()));
    }
    let key = decode_bytes(&spake).and_then(|inbound| exchange.finish(&inbound)).ok_or(PairError::WrongCode)?;
    let binding = Binding { shower_fingerprint: &session.fingerprint, joiner_fingerprint: &host.identity.fingerprint, shower_device: &device_id, joiner_device: &host.device_id };
    if !decode_bytes(&tag).is_some_and(|tag| key.verify(Role::Shower, &binding, &tag)) {
        return Err(PairError::WrongCode);
    }
    match session.call(&Request::PairConfirm { tag: encode_bytes(&key.confirm(Role::Joiner, &binding)) }).map_err(broken)? {
        Reply::PairDone => {}
        Reply::Refused { reason } => return Err(refused(reason)),
        other => return Err(PairError::Broken(format!("{other:?}"))),
    }
    let peer = Peer { fingerprint: session.fingerprint.clone(), device_id, name: clean_name(&name), address: Some(addr.to_string()), paired_at: now_ms() };
    host.add_peer(peer.clone()).map_err(PairError::Broken)?;
    Ok(peer)
}
