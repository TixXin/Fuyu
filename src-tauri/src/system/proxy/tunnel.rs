use std::{
    error::Error,
    fmt,
    io::{self, Read, Write},
    net::{SocketAddr, TcpStream, ToSocketAddrs},
    time::Duration,
};

use base64::Engine;
use tauri::Url;

use super::config::{redact_url, Hop};

const MAX_HTTP_HEADER_BYTES: usize = 16 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ConnectFault {
    Dns,
    ProxyUnreachable,
    ProxyAuth,
    ProxyAuthDomain,
    ProxyRefused,
    ProxyUpstream,
    ProxyClosed,
    ProxyBadReply,
}

#[derive(Debug)]
pub(crate) struct ConnectError {
    pub(crate) fault: ConnectFault,
    pub(crate) proxy: Option<String>,
    message: String,
}

impl fmt::Display for ConnectError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for ConnectError {}

pub(crate) fn connect_fault(error: &io::Error) -> Option<&ConnectError> {
    error.get_ref()?.downcast_ref::<ConnectError>()
}

pub(crate) fn fault(fault: ConnectFault, proxy: Option<&str>, kind: io::ErrorKind, message: impl Into<String>) -> io::Error {
    io::Error::new(
        kind,
        ConnectError {
            fault,
            proxy: proxy.map(redact_url),
            message: message.into(),
        },
    )
}

pub(crate) struct Connected {
    pub(crate) stream: TcpStream,
    pub(crate) proxy: Option<String>,
}

#[cfg(test)]
pub(crate) fn connect_tcp_resolved(
    resolved: &super::config::ResolvedProxy,
    target_host: &str,
    target_port: u16,
    timeout: Duration,
) -> io::Result<TcpStream> {
    connect_hops(&resolved.hops_for(target_host, target_port), target_host, target_port, timeout).map(|connected| connected.stream)
}

pub(crate) fn connect_hops(hops: &[Hop], target_host: &str, target_port: u16, timeout: Duration) -> io::Result<Connected> {
    let mut last_error = None;
    for (index, hop) in hops.iter().enumerate() {
        let attempt = match hop {
            Hop::Direct => connect_direct(target_host, target_port, timeout).map(|stream| Connected { stream, proxy: None }),
            Hop::Proxy(url) => connect_via_proxy(url, target_host, target_port, timeout).map(|stream| Connected {
                stream,
                proxy: Some(redact_url(url)),
            }),
        };
        match attempt {
            Ok(connected) => return Ok(connected),
            Err(error) => {
                let skip = index + 1 < hops.len()
                    && connect_fault(&error).is_some_and(|found| found.fault == ConnectFault::ProxyUnreachable);
                if !skip {
                    return Err(error);
                }
                last_error = Some(error);
            }
        }
    }
    Err(last_error.unwrap_or_else(|| io::Error::new(io::ErrorKind::AddrNotAvailable, "no route")))
}

pub(crate) fn order_addresses(addresses: impl Iterator<Item = SocketAddr>) -> Vec<SocketAddr> {
    let (mut ordered, v6): (Vec<SocketAddr>, Vec<SocketAddr>) = addresses.partition(SocketAddr::is_ipv4);
    ordered.extend(v6);
    ordered
}

fn connect_direct(host: &str, port: u16, timeout: Duration) -> io::Result<TcpStream> {
    let host = host.trim_start_matches('[').trim_end_matches(']');
    let addresses = (host, port).to_socket_addrs().map_err(|error| {
        let kind = error.kind();
        fault(ConnectFault::Dns, None, kind, format!("could not resolve {host}: {error}"))
    })?;
    let mut last_error = None;
    for address in order_addresses(addresses) {
        match TcpStream::connect_timeout(&address, timeout) {
            Ok(stream) => return Ok(stream),
            Err(error) => last_error = Some(error),
        }
    }
    Err(last_error.unwrap_or_else(|| fault(ConnectFault::Dns, None, io::ErrorKind::AddrNotAvailable, format!("{host} has no address"))))
}

fn connect_via_proxy(proxy_url: &str, target_host: &str, target_port: u16, timeout: Duration) -> io::Result<TcpStream> {
    let parsed = Url::parse(proxy_url).map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid proxy URL"))?;
    let proxy_host = parsed
        .host_str()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "missing proxy host"))?;
    let default_port = match parsed.scheme() {
        "https" => 443,
        "socks5" | "socks5h" | "socks" => 1080,
        _ => 80,
    };
    let proxy_port = parsed.port().unwrap_or(default_port);
    let mut stream = connect_direct(proxy_host, proxy_port, timeout).map_err(|error| {
        let kind = error.kind();
        fault(
            ConnectFault::ProxyUnreachable,
            Some(proxy_url),
            kind,
            format!("could not reach proxy {}: {error}", redact_url(proxy_url)),
        )
    })?;
    stream.set_read_timeout(Some(timeout))?;
    stream.set_write_timeout(Some(timeout))?;
    let username = percent_decode(parsed.username());
    let password = parsed.password().map(percent_decode);
    let handshake = match parsed.scheme() {
        "http" | "https" => http_connect(&mut stream, target_host, target_port, &username, password.as_deref()),
        "socks5" | "socks5h" | "socks" => socks5_connect(&mut stream, target_host, target_port, &username, password.as_deref()),
        scheme => {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                format!("unsupported proxy scheme: {scheme}"),
            ));
        }
    };
    handshake.map_err(|error| tag_handshake_error(error, proxy_url))?;
    Ok(stream)
}

pub(crate) fn tag_handshake_error(error: io::Error, proxy_url: &str) -> io::Error {
    let kind = error.kind();
    if let Some(found) = connect_fault(&error) {
        return fault(found.fault, Some(proxy_url), kind, found.message.clone());
    }
    let found_fault = match kind {
        io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock => ConnectFault::ProxyUpstream,
        io::ErrorKind::InvalidData => ConnectFault::ProxyBadReply,
        _ => ConnectFault::ProxyClosed,
    };
    fault(found_fault, Some(proxy_url), kind, format!("proxy handshake failed: {error}"))
}

pub(crate) fn connect_status_fault(status: u16, authenticate: &[String]) -> ConnectFault {
    match status {
        407 => {
            let basic = authenticate.is_empty()
                || authenticate.iter().any(|scheme| scheme.trim().to_ascii_lowercase().starts_with("basic"));
            if basic {
                ConnectFault::ProxyAuth
            } else {
                ConnectFault::ProxyAuthDomain
            }
        }
        502..=504 => ConnectFault::ProxyUpstream,
        _ => ConnectFault::ProxyRefused,
    }
}

fn http_connect(
    stream: &mut TcpStream,
    target_host: &str,
    target_port: u16,
    username: &str,
    password: Option<&str>,
) -> io::Result<()> {
    let authority = format_authority(target_host, target_port);
    let mut request = format!("CONNECT {authority} HTTP/1.1\r\nHost: {authority}\r\nProxy-Connection: Keep-Alive\r\n");
    if !username.is_empty() {
        let secret = password.unwrap_or("");
        let token = base64::engine::general_purpose::STANDARD.encode(format!("{username}:{secret}"));
        request.push_str(&format!("Proxy-Authorization: Basic {token}\r\n"));
    }
    request.push_str("\r\n");
    stream.write_all(request.as_bytes())?;
    stream.flush()?;

    let mut header_bytes = Vec::with_capacity(256);
    let mut byte = [0u8; 1];
    while !header_bytes.ends_with(b"\r\n\r\n") {
        if header_bytes.len() >= MAX_HTTP_HEADER_BYTES {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "proxy response header too large"));
        }
        let read = stream.read(&mut byte)?;
        if read == 0 {
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "proxy closed connection during CONNECT"));
        }
        header_bytes.push(byte[0]);
        if header_bytes.len() == 5 && !header_bytes.eq_ignore_ascii_case(b"HTTP/") {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "proxy did not answer CONNECT with HTTP"));
        }
    }
    let header_text = String::from_utf8_lossy(&header_bytes);
    let status_code = parse_connect_status(&header_text)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid proxy CONNECT response"))?;
    if (200..=299).contains(&status_code) {
        return Ok(());
    }
    let authenticate = proxy_authenticate_schemes(&header_text);
    let found = connect_status_fault(status_code, &authenticate);
    let message = match found {
        ConnectFault::ProxyAuth => "proxy authentication failed (HTTP 407)".to_string(),
        ConnectFault::ProxyAuthDomain => format!("proxy wants Windows sign-in (HTTP 407: {})", authenticate.join(", ")),
        ConnectFault::ProxyRefused => format!("proxy refused tunnel to port {target_port} (HTTP {status_code})"),
        _ => format!("proxy could not reach {authority} (HTTP {status_code})"),
    };
    let kind = match found {
        ConnectFault::ProxyUpstream => io::ErrorKind::ConnectionRefused,
        _ => io::ErrorKind::PermissionDenied,
    };
    Err(fault(found, None, kind, message))
}

pub(crate) fn parse_connect_status(header_text: &str) -> Option<u16> {
    let status_line = header_text.lines().next()?.trim();
    let (version, rest) = status_line.split_once(' ')?;
    if !version.to_ascii_uppercase().starts_with("HTTP/") {
        return None;
    }
    rest.split_whitespace().next()?.parse::<u16>().ok()
}

pub(crate) fn proxy_authenticate_schemes(header_text: &str) -> Vec<String> {
    header_text
        .lines()
        .filter_map(|line| line.split_once(':'))
        .filter(|(name, _)| name.trim().eq_ignore_ascii_case("proxy-authenticate"))
        .filter_map(|(_, value)| value.split_whitespace().next().map(str::to_string))
        .collect()
}

fn socks5_connect(
    stream: &mut TcpStream,
    target_host: &str,
    target_port: u16,
    username: &str,
    password: Option<&str>,
) -> io::Result<()> {
    let use_auth = !username.is_empty();
    let greeting: &[u8] = if use_auth { &[0x05, 0x02, 0x00, 0x02] } else { &[0x05, 0x01, 0x00] };
    stream.write_all(greeting)?;
    stream.flush()?;

    let mut method_reply = [0u8; 2];
    stream.read_exact(&mut method_reply)?;
    if method_reply[0] != 0x05 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "proxy is not SOCKS5"));
    }
    let auth_fault = |message: &str| fault(ConnectFault::ProxyAuth, None, io::ErrorKind::PermissionDenied, message);
    match method_reply[1] {
        0x00 => {}
        0x02 => {
            if !use_auth {
                return Err(auth_fault("SOCKS5 proxy requires authentication"));
            }
            let secret = password.unwrap_or("");
            let user_bytes = username.as_bytes();
            let pass_bytes = secret.as_bytes();
            if user_bytes.len() > 255 || pass_bytes.len() > 255 {
                return Err(io::Error::new(io::ErrorKind::InvalidInput, "SOCKS5 credentials are too long"));
            }
            let mut auth = Vec::with_capacity(3 + user_bytes.len() + pass_bytes.len());
            auth.push(0x01);
            auth.push(user_bytes.len() as u8);
            auth.extend_from_slice(user_bytes);
            auth.push(pass_bytes.len() as u8);
            auth.extend_from_slice(pass_bytes);
            stream.write_all(&auth)?;
            stream.flush()?;

            let mut auth_reply = [0u8; 2];
            stream.read_exact(&mut auth_reply)?;
            if auth_reply[1] != 0x00 {
                return Err(auth_fault("SOCKS5 authentication failed"));
            }
        }
        0xFF => return Err(auth_fault("SOCKS5 proxy rejected auth methods")),
        method => {
            return Err(fault(
                ConnectFault::ProxyBadReply,
                None,
                io::ErrorKind::Unsupported,
                format!("SOCKS5 proxy selected unsupported auth method {method}"),
            ));
        }
    }

    let clean_host = target_host.trim_start_matches('[').trim_end_matches(']');
    let host_bytes = clean_host.as_bytes();
    if host_bytes.is_empty() || host_bytes.len() > 255 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "target host is invalid for SOCKS5"));
    }
    let mut request = Vec::with_capacity(7 + host_bytes.len());
    request.extend_from_slice(&[0x05, 0x01, 0x00, 0x03, host_bytes.len() as u8]);
    request.extend_from_slice(host_bytes);
    request.extend_from_slice(&target_port.to_be_bytes());
    stream.write_all(&request)?;
    stream.flush()?;

    let mut reply_head = [0u8; 4];
    stream.read_exact(&mut reply_head)?;
    if reply_head[0] != 0x05 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "invalid SOCKS5 connect response"));
    }
    if reply_head[1] != 0x00 {
        let (found, message) = socks5_reply_fault(reply_head[1]);
        return Err(fault(found, None, io::ErrorKind::ConnectionRefused, message));
    }
    match reply_head[3] {
        0x01 => {
            let mut rest = [0u8; 6];
            stream.read_exact(&mut rest)?;
        }
        0x03 => {
            let mut len = [0u8; 1];
            stream.read_exact(&mut len)?;
            let mut rest = vec![0u8; usize::from(len[0]) + 2];
            stream.read_exact(&mut rest)?;
        }
        0x04 => {
            let mut rest = [0u8; 18];
            stream.read_exact(&mut rest)?;
        }
        _ => {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "unknown SOCKS5 address type"));
        }
    }
    Ok(())
}

pub(crate) fn socks5_reply_fault(code: u8) -> (ConnectFault, &'static str) {
    match code {
        0x01 => (ConnectFault::ProxyUpstream, "SOCKS5 server failure"),
        0x02 => (ConnectFault::ProxyRefused, "SOCKS5 connection not allowed by ruleset"),
        0x03 => (ConnectFault::ProxyUpstream, "SOCKS5 network unreachable"),
        0x04 => (ConnectFault::ProxyUpstream, "SOCKS5 host unreachable"),
        0x05 => (ConnectFault::ProxyUpstream, "SOCKS5 connection refused"),
        0x06 => (ConnectFault::ProxyUpstream, "SOCKS5 TTL expired"),
        0x07 => (ConnectFault::ProxyBadReply, "SOCKS5 command not supported"),
        0x08 => (ConnectFault::ProxyBadReply, "SOCKS5 address type not supported"),
        _ => (ConnectFault::ProxyRefused, "SOCKS5 connection failed"),
    }
}

fn format_authority(host: &str, port: u16) -> String {
    if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]:{port}")
    } else {
        format!("{host}:{port}")
    }
}

fn percent_decode(raw: &str) -> String {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[index + 1..index + 3]) {
                if let Ok(value) = u8::from_str_radix(hex, 16) {
                    out.push(value);
                    index += 3;
                    continue;
                }
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}
