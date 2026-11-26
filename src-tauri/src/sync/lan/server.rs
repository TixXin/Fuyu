use rustls::{ServerConfig, ServerConnection, StreamOwned};
use std::{
    io::{self, ErrorKind},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use super::{
    host::Host,
    pairing::{self, Binding, Role},
    peers::{clean_name, now_ms, Peer},
    tls::{peer_fingerprint, server_config},
    wire::{decode_bytes, encode_bytes, read_frame, reason, write_frame, Reply, Request},
};

pub(crate) const DEFAULT_PORT: u16 = 47321;
pub(crate) const IO_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_CONNECTIONS: usize = 8;
const ACCEPT_PAUSE: Duration = Duration::from_millis(150);

type Tls = StreamOwned<ServerConnection, TcpStream>;

pub(crate) struct Listener {
    port: u16,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl Listener {
    pub(crate) fn port(&self) -> u16 {
        self.port
    }

    pub(crate) fn stop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

impl Drop for Listener {
    fn drop(&mut self) {
        self.stop();
    }
}

fn bind(port: u16) -> io::Result<TcpListener> {
    match TcpListener::bind(("0.0.0.0", port)) {
        Err(error) if port != 0 && error.kind() == ErrorKind::AddrInUse => TcpListener::bind(("0.0.0.0", 0)),
        other => other,
    }
}

pub(crate) fn listen(host: Arc<Host>, port: u16) -> io::Result<Listener> {
    let socket = bind(port)?;
    socket.set_nonblocking(true)?;
    let port = socket.local_addr()?.port();
    let pins_host = host.clone();
    let config = server_config(&host.identity, Arc::new(move |fingerprint: &str| pins_host.admits(fingerprint))).map_err(io::Error::other)?;
    let stop = Arc::new(AtomicBool::new(false));
    let flag = stop.clone();
    let thread = thread::Builder::new().name("fuyu-lan-listen".into()).spawn(move || accept_loop(&socket, &host, &config, &flag))?;
    Ok(Listener { port, stop, thread: Some(thread) })
}

fn accept_loop(socket: &TcpListener, host: &Arc<Host>, config: &Arc<ServerConfig>, stop: &AtomicBool) {
    let active = Arc::new(AtomicUsize::new(0));
    while !stop.load(Ordering::SeqCst) {
        match socket.accept() {
            Ok((stream, _)) => {
                if active.fetch_add(1, Ordering::SeqCst) >= MAX_CONNECTIONS {
                    active.fetch_sub(1, Ordering::SeqCst);
                    continue;
                }
                let (host, config, counter) = (host.clone(), config.clone(), active.clone());
                let spawned = thread::Builder::new().name("fuyu-lan-peer".into()).spawn(move || {
                    let _ = handle(&host, config, stream);
                    counter.fetch_sub(1, Ordering::SeqCst);
                });
                if spawned.is_err() {
                    active.fetch_sub(1, Ordering::SeqCst);
                }
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => thread::sleep(ACCEPT_PAUSE),
            Err(_) => thread::sleep(ACCEPT_PAUSE),
        }
    }
}

pub(crate) fn prepare(stream: &TcpStream) -> io::Result<()> {
    stream.set_nonblocking(false)?;
    stream.set_read_timeout(Some(IO_TIMEOUT))?;
    stream.set_write_timeout(Some(IO_TIMEOUT))?;
    stream.set_nodelay(true)
}

fn handle(host: &Host, config: Arc<ServerConfig>, stream: TcpStream) -> io::Result<()> {
    prepare(&stream)?;
    let mut tls = StreamOwned::new(ServerConnection::new(config).map_err(io::Error::other)?, stream);
    while tls.conn.is_handshaking() {
        tls.conn.complete_io(&mut tls.sock)?;
    }
    let Some(fingerprint) = peer_fingerprint(&tls.conn) else {
        return Ok(());
    };
    match host.peer(&fingerprint) {
        Some(peer) => serve_peer(host, &mut tls, &peer),
        None => serve_pairing(host, &mut tls, &fingerprint),
    }
}

fn refuse(tls: &mut Tls, why: &str) -> io::Result<()> {
    write_frame(tls, &Reply::Refused { reason: why.to_string() })
}

fn serve_peer(host: &Host, tls: &mut Tls, peer: &Peer) -> io::Result<()> {
    loop {
        let request: Request = match read_frame(tls) {
            Ok(request) => request,
            Err(error) if error.kind() == ErrorKind::UnexpectedEof => return Ok(()),
            Err(error) => return Err(error),
        };
        let reply = match request {
            Request::List { dir } => host.serve.list(&dir).map(|entries| Reply::Entries { entries }),
            Request::Read { path } => host.serve.read(&path).map(|bytes| Reply::Data { bytes: bytes.as_deref().map(encode_bytes) }),
            Request::PushClip { item } if host.clip_push() => host.serve.clip(peer, item).map(|()| Reply::Done),
            Request::PushClip { .. } => Err("clipboard push is off".into()),
            Request::Poke => {
                host.serve.poke();
                Ok(Reply::Done)
            }
            Request::PairStart { .. } | Request::PairConfirm { .. } => Ok(Reply::Refused { reason: reason::BAD_REQUEST.into() }),
        };
        write_frame(tls, &reply.unwrap_or_else(|_| Reply::Refused { reason: reason::FAILED.into() }))?;
    }
}

fn serve_pairing(host: &Host, tls: &mut Tls, fingerprint: &str) -> io::Result<()> {
    let Request::PairStart { device_id, name, spake } = read_frame(tls)? else {
        return refuse(tls, reason::NOT_PAIRED);
    };
    if !crate::sync::device::is_valid_id(&device_id) {
        return refuse(tls, reason::BAD_REQUEST);
    }
    let code = match host.admit(Instant::now()) {
        Ok(code) => code,
        Err(why) => return refuse(tls, why),
    };
    let (exchange, outbound) = pairing::start(&code);
    let Some(key) = decode_bytes(&spake).and_then(|inbound| exchange.finish(&inbound)) else {
        return refuse(tls, reason::WRONG_CODE);
    };
    let binding = Binding { shower_fingerprint: &host.identity.fingerprint, joiner_fingerprint: fingerprint, shower_device: &host.device_id, joiner_device: &device_id };
    let tag = encode_bytes(&key.confirm(Role::Shower, &binding));
    write_frame(tls, &Reply::PairAnswer { device_id: host.device_id.clone(), name: host.name.clone(), spake: encode_bytes(&outbound), tag })?;
    let Request::PairConfirm { tag } = read_frame(tls)? else {
        return refuse(tls, reason::BAD_REQUEST);
    };
    if !decode_bytes(&tag).is_some_and(|tag| key.verify(Role::Joiner, &binding, &tag)) {
        return refuse(tls, reason::WRONG_CODE);
    }
    let peer = Peer { fingerprint: fingerprint.to_string(), device_id, name: clean_name(&name), address: None, paired_at: now_ms() };
    if host.add_peer(peer.clone()).is_err() {
        return refuse(tls, reason::FAILED);
    }
    host.close_pairing();
    host.serve.paired(&peer);
    write_frame(tls, &Reply::PairDone)
}
