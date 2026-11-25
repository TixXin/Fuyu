use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
    time::Duration,
};

use super::config::{
    build_proxy_url, is_loopback_host, load_file, normalize_host_and_port, parse_bypass_list, redact_url, save_file,
    validate_settings, ProxyMode, ProxyScheme, ProxySettings, ProxyTarget, ResolvedProxy, SaveNetworkProxyInput,
};
use super::system_detect::{normalize_proxy_entry, parse_scutil_proxy};
use super::tunnel::connect_tcp_resolved;

#[test]
fn validates_manual_settings_and_normalizes_pasted_urls() {
    let input = SaveNetworkProxyInput {
        mode: ProxyMode::Manual,
        scheme: ProxyScheme::Http,
        host: "socks5://10.0.0.8:1080/path".into(),
        port: None,
        username: " alice ".into(),
        password: None,
        bypass: "localhost; *.corp.local\n192.168.1.1, localhost".into(),
    };
    let saved = validate_settings(&input).expect("valid manual settings");
    assert_eq!(saved.mode, ProxyMode::Manual);
    assert_eq!(saved.scheme, ProxyScheme::Socks5);
    assert_eq!(saved.host, "10.0.0.8");
    assert_eq!(saved.port, Some(1080));
    assert_eq!(saved.username, "alice");
    assert_eq!(saved.bypass, "localhost, *.corp.local, 192.168.1.1");

    let missing_host = SaveNetworkProxyInput {
        mode: ProxyMode::Manual,
        scheme: ProxyScheme::Http,
        host: "  ".into(),
        port: Some(8080),
        username: String::new(),
        password: None,
        bypass: String::new(),
    };
    assert_eq!(validate_settings(&missing_host).unwrap_err().code(), "net.proxyHostRequired");

    let bad_port = SaveNetworkProxyInput {
        mode: ProxyMode::Manual,
        scheme: ProxyScheme::Http,
        host: "proxy.corp.local".into(),
        port: Some(0),
        username: String::new(),
        password: None,
        bypass: String::new(),
    };
    assert_eq!(validate_settings(&bad_port).unwrap_err().code(), "net.proxyPort");
}

#[test]
fn builds_and_redacts_proxy_urls_with_special_credentials() {
    let url = build_proxy_url(ProxyScheme::Http, "proxy.corp.local", 8080, "corp\\alice", Some("p@ss:w/ord"))
        .expect("builds url");
    assert!(url.as_str().starts_with("http://corp%5Calice:p%40ss%3Aw%2Ford@proxy.corp.local:8080"));
    assert_eq!(redact_url(url.as_str()), "http://proxy.corp.local:8080");

    let socks = build_proxy_url(ProxyScheme::Socks5, "127.0.0.1", 1080, "", None).expect("builds socks5h");
    assert_eq!(socks.scheme(), "socks5h");
    assert_eq!(redact_url(socks.as_str()), "socks5h://127.0.0.1:1080");
}

#[test]
fn matches_bypass_rules_and_loopback_hosts() {
    assert!(is_loopback_host("localhost"));
    assert!(is_loopback_host("127.0.0.1"));
    assert!(is_loopback_host("::1"));
    assert!(!is_loopback_host("github.com"));

    let target = ProxyTarget {
        url: "http://10.0.0.1:8080".into(),
        bypass: parse_bypass_list("*.corp.local, .internal.net, 10.*, <local>, exact.example.com:443"),
    };
    assert!(target.should_bypass("localhost"));
    assert!(target.should_bypass("127.0.0.1"));
    assert!(target.should_bypass("git.corp.local"));
    assert!(target.should_bypass("corp.local"));
    assert!(target.should_bypass("mail.internal.net"));
    assert!(target.should_bypass("10.20.30.40"));
    assert!(target.should_bypass("intranet"));
    assert!(target.should_bypass("exact.example.com"));
    assert!(!target.should_bypass("notcorp.local"));
    assert!(!target.should_bypass("api.github.com"));
}

#[test]
fn parses_windows_proxy_entries_and_macos_scutil_output() {
    assert_eq!(normalize_proxy_entry("http=10.0.0.1:8080;https=10.0.0.2:8443"), "http://10.0.0.2:8443");
    assert_eq!(normalize_proxy_entry("socks=127.0.0.1:1080"), "socks5h://127.0.0.1:1080");
    assert_eq!(normalize_proxy_entry("proxy.company.com:3128"), "http://proxy.company.com:3128");

    let scutil = "\
<dictionary> {
  ExceptionsList : <array> {
    0 : *.local
    1 : 169.254/16
  }
  HTTPEnable : 1
  HTTPPort : 8080
  HTTPProxy : proxy.corp.local
  HTTPSEnable : 1
  HTTPSPort : 8443
  HTTPSProxy : secure.corp.local
}";
    let parsed = parse_scutil_proxy(scutil).expect("scutil parsed");
    assert_eq!(parsed.url, "http://secure.corp.local:8443");
    assert_eq!(parsed.bypass, vec!["*.local", "169.254"]);

    let socks_only = "  SOCKSEnable : 1\n  SOCKSProxy : 127.0.0.1\n  SOCKSPort : 1080\n";
    let parsed = parse_scutil_proxy(socks_only).expect("socks parsed");
    assert_eq!(parsed.url, "socks5h://127.0.0.1:1080");
}

#[test]
fn persists_and_reloads_proxy_settings_file() {
    let dir = std::env::temp_dir().join(format!("fuyu-proxy-test-{}", std::process::id()));
    let path = dir.join("network-proxy.json");
    let expected = ProxySettings {
        mode: ProxyMode::Manual,
        scheme: ProxyScheme::Http,
        host: "proxy.example.com".into(),
        port: Some(8080),
        username: "user".into(),
        bypass: "localhost, .corp.local".into(),
    };
    save_file(&path, &expected).expect("save file");
    assert_eq!(load_file(&path), expected);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn normalizes_ipv6_host_and_port() {
    let (scheme, host, port) = normalize_host_and_port(ProxyScheme::Http, "[::1]:8080", None).expect("ipv6");
    assert_eq!(scheme, ProxyScheme::Http);
    assert_eq!(host, "::1");
    assert_eq!(port, Some(8080));
}

#[test]
fn tunnels_tcp_over_http_connect_with_basic_auth() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind http proxy");
    let port = listener.local_addr().expect("local addr").port();
    let server = thread::spawn(move || {
        let (mut socket, _) = listener.accept().expect("accept");
        let mut buf = [0u8; 1024];
        let n = socket.read(&mut buf).expect("read request");
        let text = String::from_utf8_lossy(&buf[..n]).into_owned();
        assert!(text.starts_with("CONNECT imap.example.com:993 HTTP/1.1\r\n"));
        assert!(text.contains("Proxy-Authorization: Basic YWxpY2U6c2VjcmV0\r\n"));
        socket.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n").expect("write 200");
        socket.write_all(b"HELLO-TUNNEL").expect("write payload");
    });

    let resolved = ResolvedProxy::Proxy(ProxyTarget {
        url: format!("http://alice:secret@127.0.0.1:{port}"),
        bypass: Vec::new(),
    });
    let mut stream = connect_tcp_resolved(&resolved, "imap.example.com", 993, Duration::from_secs(5))
        .expect("connect via http proxy");
    let mut reply = [0u8; 12];
    stream.read_exact(&mut reply).expect("read payload");
    assert_eq!(&reply, b"HELLO-TUNNEL");
    server.join().expect("server thread");
}

#[test]
fn reports_http_connect_auth_and_forbidden_errors() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().expect("addr").port();
    let server = thread::spawn(move || {
        let (mut socket, _) = listener.accept().expect("accept");
        let mut buf = [0u8; 512];
        let _ = socket.read(&mut buf);
        socket.write_all(b"HTTP/1.1 407 Proxy Authentication Required\r\n\r\n").expect("write 407");
    });
    let resolved = ResolvedProxy::Proxy(ProxyTarget {
        url: format!("http://127.0.0.1:{port}"),
        bypass: Vec::new(),
    });
    let err = connect_tcp_resolved(&resolved, "imap.example.com", 993, Duration::from_secs(5)).unwrap_err();
    assert!(err.to_string().contains("407"));
    server.join().expect("server thread");
}

#[test]
fn tunnels_tcp_over_socks5_with_username_password() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind socks5");
    let port = listener.local_addr().expect("addr").port();
    let server = thread::spawn(move || {
        let (mut socket, _) = listener.accept().expect("accept");
        let mut greet = [0u8; 4];
        socket.read_exact(&mut greet).expect("greet");
        assert_eq!(greet, [0x05, 0x02, 0x00, 0x02]);
        socket.write_all(&[0x05, 0x02]).expect("choose user/pass");

        let mut auth = [0u8; 13];
        socket.read_exact(&mut auth).expect("auth");
        assert_eq!(&auth, b"\x01\x05alice\x05pass!");
        socket.write_all(&[0x01, 0x00]).expect("auth ok");

        let mut req_head = [0u8; 5];
        socket.read_exact(&mut req_head).expect("req head");
        assert_eq!(&req_head[..4], &[0x05, 0x01, 0x00, 0x03]);
        let mut rest = vec![0u8; usize::from(req_head[4]) + 2];
        socket.read_exact(&mut rest).expect("req host+port");
        assert_eq!(&rest[..rest.len() - 2], b"smtp.example.com");
        assert_eq!(u16::from_be_bytes([rest[rest.len() - 2], rest[rest.len() - 1]]), 465);

        socket.write_all(&[0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]).expect("connect ok");
        socket.write_all(b"SOCKS5-OK").expect("write payload");
    });

    let resolved = ResolvedProxy::Proxy(ProxyTarget {
        url: format!("socks5h://alice:pass%21@127.0.0.1:{port}"),
        bypass: Vec::new(),
    });
    let mut stream = connect_tcp_resolved(&resolved, "smtp.example.com", 465, Duration::from_secs(5))
        .expect("connect via socks5");
    let mut reply = [0u8; 9];
    stream.read_exact(&mut reply).expect("read payload");
    assert_eq!(&reply, b"SOCKS5-OK");
    server.join().expect("server thread");
}

#[test]
fn probe_measures_warm_keep_alive_rtt_instead_of_cold_handshake() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind probe server");
    let port = listener.local_addr().expect("addr").port();
    let server = thread::spawn(move || {
        let (mut socket, _) = listener.accept().expect("accept");
        let _ = socket.set_read_timeout(Some(Duration::from_secs(5)));
        let mut buf = [0u8; 1024];
        let _ = socket.read(&mut buf).expect("read cold");
        thread::sleep(Duration::from_millis(120));
        socket
            .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: keep-alive\r\n\r\n")
            .expect("write cold");
        let _ = socket.read(&mut buf).expect("read warm");
        socket
            .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .expect("write warm");
    });

    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("build client");
    let url = format!("http://127.0.0.1:{port}/generate_204");
    let result = tauri::async_runtime::block_on(super::probe_targets(&client, &[url.as_str()], None))
        .expect("probe ok");
    assert!(result.ok);
    assert!(result.latency_ms < 80, "expected warm RTT < 80ms, got {}ms", result.latency_ms);
    server.join().expect("server thread");
}
