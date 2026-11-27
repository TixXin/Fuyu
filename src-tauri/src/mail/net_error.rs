use std::{error::Error, io};

use crate::system::proxy::{connect_fault, ConnectError, ConnectFault};
use crate::user_error::UserError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Stage {
    Connect,
    Tls,
    Greeting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Signal {
    Fault(ConnectFault),
    Certificate,
    Reset,
    Timeout,
    Refused,
    Unreachable,
    Other,
}

pub(super) struct Endpoint<'a> {
    pub(super) host: &'a str,
    pub(super) port: u16,
    pub(super) proxy: Option<&'a str>,
}

const CERTIFICATE_CODES: [i32; 10] = [
    -2146893019,
    -2146893022,
    -2146893016,
    -2146893017,
    -2146762487,
    -2146762495,
    -2146762481,
    -2146885613,
    -2146885614,
    -2146762486,
];
const CERTIFICATE_WORDS: [&str; 9] = [
    "certificate",
    "cert verify",
    "untrusted",
    "not trusted",
    "self signed",
    "self-signed",
    "unknown issuer",
    "principal name",
    "revocation",
];
const RESET_WORDS: [&str; 7] = [
    "forcibly closed",
    "connection reset",
    "unexpected eof",
    "closed via error",
    "connection was aborted",
    "broken pipe",
    "connection closed",
];

pub(super) fn signal_of(error: &(dyn Error + 'static)) -> (Signal, Option<String>) {
    let mut current = Some(error);
    let mut text = String::new();
    let mut by_kind = None;
    while let Some(found) = current {
        if let Some(connect) = found.downcast_ref::<ConnectError>() {
            return (Signal::Fault(connect.fault), connect.proxy.clone());
        }
        if let Some(io_error) = found.downcast_ref::<io::Error>() {
            if let Some(connect) = connect_fault(io_error) {
                return (Signal::Fault(connect.fault), connect.proxy.clone());
            }
            by_kind = by_kind
                .or_else(|| kind_signal(io_error.kind()))
                .or_else(|| io_error.raw_os_error().and_then(code_signal));
        }
        text.push_str(&found.to_string());
        text.push(' ');
        current = found.source();
    }
    (text_signal(&text, by_kind), None)
}

fn text_signal(text: &str, by_kind: Option<Signal>) -> Signal {
    let lower = text.to_ascii_lowercase();
    let code = os_error_code(&lower);
    if code.is_some_and(|code| CERTIFICATE_CODES.contains(&code)) || CERTIFICATE_WORDS.iter().any(|word| lower.contains(word)) {
        return Signal::Certificate;
    }
    if let Some(signal) = by_kind.or_else(|| code.and_then(code_signal)) {
        return signal;
    }
    if RESET_WORDS.iter().any(|word| lower.contains(word)) {
        Signal::Reset
    } else if lower.contains("timed out") || lower.contains("timeout") {
        Signal::Timeout
    } else if lower.contains("refused") {
        Signal::Refused
    } else if lower.contains("unreachable") {
        Signal::Unreachable
    } else {
        Signal::Other
    }
}

fn os_error_code(text: &str) -> Option<i32> {
    let (_, rest) = text.rsplit_once("os error ")?;
    let digits: String = rest.chars().take_while(|ch| *ch == '-' || ch.is_ascii_digit()).collect();
    digits.parse().ok()
}

fn code_signal(code: i32) -> Option<Signal> {
    match code {
        10053 | 10054 => Some(Signal::Reset),
        10060 => Some(Signal::Timeout),
        10061 => Some(Signal::Refused),
        10050 | 10051 | 10065 => Some(Signal::Unreachable),
        _ if code < 0 => None,
        _ => kind_signal(io::Error::from_raw_os_error(code).kind()),
    }
}

fn kind_signal(kind: io::ErrorKind) -> Option<Signal> {
    match kind {
        io::ErrorKind::ConnectionReset
        | io::ErrorKind::ConnectionAborted
        | io::ErrorKind::UnexpectedEof
        | io::ErrorKind::BrokenPipe => Some(Signal::Reset),
        io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock => Some(Signal::Timeout),
        io::ErrorKind::ConnectionRefused => Some(Signal::Refused),
        io::ErrorKind::NetworkUnreachable | io::ErrorKind::HostUnreachable | io::ErrorKind::NetworkDown => {
            Some(Signal::Unreachable)
        }
        _ => None,
    }
}

pub(super) fn classify(stage: Stage, error: &(dyn Error + 'static), endpoint: &Endpoint) -> Option<UserError> {
    let (signal, fault_proxy) = signal_of(error);
    let proxy = fault_proxy.or_else(|| endpoint.proxy.map(str::to_string));
    user_error(stage, signal, endpoint, proxy.as_deref())
}

pub(super) fn user_error(stage: Stage, signal: Signal, endpoint: &Endpoint, proxy: Option<&str>) -> Option<UserError> {
    let host = endpoint.host;
    let port = endpoint.port;
    let via_proxy = proxy.is_some();
    let target = |error: UserError| error.arg("host", host).arg("port", port);
    let error = match signal {
        Signal::Fault(ConnectFault::Dns) => target(UserError::new(
            "mail.dns",
            format!("Could not find the mail server {host}; check the server address or the network's DNS."),
        )),
        Signal::Fault(ConnectFault::ProxyUnreachable) => UserError::new(
            "mail.proxyUnreachable",
            "Could not reach the proxy; check that the proxy app is running and the address is right.",
        )
        .arg("proxy", proxy.unwrap_or_default()),
        Signal::Fault(ConnectFault::ProxyAuth) => UserError::new(
            "mail.proxyAuth",
            "The proxy wants a user name and password; fill them in under Settings > Network proxy (manual).",
        ),
        Signal::Fault(ConnectFault::ProxyAuthDomain) => UserError::new(
            "mail.proxyAuthDomain",
            "The proxy wants a Windows domain sign-in, which Fuyu can't do yet; ask IT to allow the mail ports, or forward through a local proxy app.",
        ),
        Signal::Fault(ConnectFault::ProxyRefused) => target(UserError::new(
            "mail.proxyPortBlocked",
            format!("The proxy does not allow port {port}; company proxies often only allow web traffic (443). Ask IT to allow the mail ports, or use another proxy."),
        )),
        Signal::Fault(ConnectFault::ProxyUpstream) => target(UserError::new(
            "mail.proxyUpstream",
            format!("The proxy could not reach {host}:{port}; check the server address or the proxy's network."),
        )),
        Signal::Fault(ConnectFault::ProxyClosed) => target(proxy_closed(port)),
        Signal::Fault(ConnectFault::ProxyBadReply) => UserError::new(
            "mail.proxyBadReply",
            "The proxy answered in an unexpected way; check whether it is an HTTP or SOCKS5 proxy and pick the matching type.",
        ),
        Signal::Certificate if stage != Stage::Connect => UserError::new(
            "mail.tlsCert",
            "The mail server's certificate is not trusted; a company security device may be inspecting encrypted traffic. Install the company root certificate or ask IT to exempt the mail server.",
        ),
        Signal::Reset | Signal::Timeout | Signal::Refused if stage == Stage::Connect => target(UserError::new(
            "mail.portBlocked",
            format!("Could not connect to {host}:{port}; a firewall may block this port. If your network needs a proxy, set it under Settings > Network proxy."),
        )),
        Signal::Reset if via_proxy => target(proxy_closed(port)),
        Signal::Reset => target(UserError::new(
            "mail.resetDirect",
            format!("The connection to {host}:{port} was cut during the encrypted handshake, usually by a company firewall that blocks mail ports. If your network uses a proxy or an auto-config (PAC) script, check what Settings > Network proxy detects."),
        )),
        Signal::Timeout => UserError::new("mail.timeout", "The mail server did not answer in time; check the network or try again later."),
        Signal::Unreachable => UserError::new("mail.offline", "The network is unreachable; check that this computer is online."),
        Signal::Certificate | Signal::Refused | Signal::Other => return None,
    };
    Some(error)
}

fn proxy_closed(port: u16) -> UserError {
    UserError::new(
        "mail.proxyClosed",
        format!("The proxy let the connection through, then cut it during the encrypted handshake; it probably only allows web traffic. Ask IT to allow port {port}, or use another proxy."),
    )
}

pub(super) fn or_classified(stage: Stage, error: &(dyn Error + 'static), endpoint: &Endpoint, fallback: UserError) -> UserError {
    classify(stage, error, endpoint).unwrap_or(fallback).detail(error)
}

pub(super) fn handshake_error<S: std::fmt::Debug>(error: native_tls::HandshakeError<S>, endpoint: &Endpoint) -> UserError {
    let fallback = UserError::new("mail.tls", "Could not set up an encrypted connection.");
    match error {
        native_tls::HandshakeError::Failure(error) => or_classified(Stage::Tls, &error, endpoint, fallback),
        native_tls::HandshakeError::WouldBlock(_) => {
            or_classified(Stage::Tls, &io::Error::from(io::ErrorKind::TimedOut), endpoint, fallback)
        }
    }
}
