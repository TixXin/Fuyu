use std::{
    io::{self, Read, Write},
    net::{TcpStream, ToSocketAddrs},
    time::Duration,
};

use base64::Engine;
use tauri::Url;

use super::config::{ProxyTarget, ResolvedProxy};

const MAX_HTTP_HEADER_BYTES: usize = 16 * 1024;

pub(crate) fn connect_tcp_resolved(
    resolved: &ResolvedProxy,
    target_host: &str,
    target_port: u16,
    timeout: Duration,
) -> io::Result<TcpStream> {
    match resolved {
        ResolvedProxy::Direct => connect_direct(target_host, target_port, timeout),
        ResolvedProxy::Proxy(proxy) => {
            if proxy.should_bypass(target_host) {
                connect_direct(target_host, target_port, timeout)
            } else {
                connect_via_proxy(proxy, target_host, target_port, timeout)
            }
        }
    }
}

fn connect_direct(host: &str, port: u16, timeout: Duration) -> io::Result<TcpStream> {
    let addresses = (host, port).to_socket_addrs()?;
    let mut last_error = None;
    for address in addresses {
        match TcpStream::connect_timeout(&address, timeout) {
            Ok(stream) => return Ok(stream),
            Err(error) => last_error = Some(error),
        }
    }
    Err(last_error.unwrap_or_else(|| io::Error::new(io::ErrorKind::AddrNotAvailable, "no address")))
}

fn connect_via_proxy(
    proxy: &ProxyTarget,
    target_host: &str,
    target_port: u16,
    timeout: Duration,
) -> io::Result<TcpStream> {
    let parsed = Url::parse(&proxy.url)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid proxy URL"))?;
    let proxy_host = parsed
        .host_str()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "missing proxy host"))?;
    let default_port = match parsed.scheme() {
        "https" => 443,
        "socks5" | "socks5h" | "socks" => 1080,
        _ => 80,
    };
    let proxy_port = parsed.port().unwrap_or(default_port);
    let mut stream = connect_direct(proxy_host, proxy_port, timeout)?;
    stream.set_read_timeout(Some(timeout))?;
    stream.set_write_timeout(Some(timeout))?;
    let username = percent_decode(parsed.username());
    let password = parsed.password().map(percent_decode);
    match parsed.scheme() {
        "http" | "https" => http_connect(&mut stream, target_host, target_port, &username, password.as_deref())?,
        "socks5" | "socks5h" | "socks" => socks5_connect(&mut stream, target_host, target_port, &username, password.as_deref())?,
        scheme => {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                format!("unsupported proxy scheme: {scheme}"),
            ));
        }
    }
    Ok(stream)
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
    }
    let header_text = String::from_utf8_lossy(&header_bytes);
    let status_line = header_text.lines().next().unwrap_or_default().trim();
    let status_code = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|part| part.parse::<u16>().ok())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid proxy CONNECT response"))?;
    match status_code {
        200..=299 => Ok(()),
        407 => Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "proxy authentication failed (HTTP 407)",
        )),
        403 => Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            format!("proxy refused tunnel to port {target_port} (HTTP 403)"),
        )),
        code => Err(io::Error::new(
            io::ErrorKind::ConnectionRefused,
            format!("proxy CONNECT failed with HTTP {code}"),
        )),
    }
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
    match method_reply[1] {
        0x00 => {}
        0x02 => {
            if !use_auth {
                return Err(io::Error::new(io::ErrorKind::PermissionDenied, "SOCKS5 proxy requires authentication"));
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
                return Err(io::Error::new(io::ErrorKind::PermissionDenied, "SOCKS5 authentication failed"));
            }
        }
        0xFF => {
            return Err(io::Error::new(io::ErrorKind::PermissionDenied, "SOCKS5 proxy rejected auth methods"));
        }
        method => {
            return Err(io::Error::new(
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
        return Err(io::Error::new(
            io::ErrorKind::ConnectionRefused,
            socks5_error_message(reply_head[1]),
        ));
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

fn socks5_error_message(code: u8) -> &'static str {
    match code {
        0x01 => "SOCKS5 server failure",
        0x02 => "SOCKS5 connection not allowed by ruleset",
        0x03 => "SOCKS5 network unreachable",
        0x04 => "SOCKS5 host unreachable",
        0x05 => "SOCKS5 connection refused",
        0x06 => "SOCKS5 TTL expired",
        0x07 => "SOCKS5 command not supported",
        0x08 => "SOCKS5 address type not supported",
        _ => "SOCKS5 connection failed",
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
