use std::{
    cell::Cell,
    sync::atomic::{AtomicUsize, Ordering},
    io::{Read, Write},
    net::{SocketAddr, TcpListener},
    thread,
    time::Duration,
};

use super::config::{AutoProxy, Hop, ProxyTarget, ResolvedProxy};
use super::pac::{evaluate_and_store, parse_pac_result, resolve_or_defer, target_url, Evaluator, PacSource, Wait};
use super::system_detect::{parse_scutil_config, OsProxyConfig};
use super::tunnel::{
    connect_fault, connect_hops, connect_status_fault, order_addresses, parse_connect_status, proxy_authenticate_schemes,
    socks5_reply_fault, ConnectFault,
};

fn proxy(url: &str) -> Hop {
    Hop::Proxy(url.to_string())
}

#[test]
fn parses_pac_results_from_scripts_winhttp_and_cfnetwork() {
    assert_eq!(parse_pac_result("PROXY proxy.corp:8080; DIRECT"), vec![proxy("http://proxy.corp:8080"), Hop::Direct]);
    assert_eq!(
        parse_pac_result("proxy a:3128;  SOCKS5 b:1080 ; SOCKS4 c:1080; SOCKS d:1081; HTTPS secure.corp:443; DIRECT"),
        vec![
            proxy("http://a:3128"),
            proxy("socks5h://b:1080"),
            proxy("socks5h://d:1081"),
            proxy("https://secure.corp:443"),
            Hop::Direct,
        ]
    );
    assert_eq!(parse_pac_result("10.0.0.1:8080;10.0.0.2:8080"), vec![proxy("http://10.0.0.1:8080"), proxy("http://10.0.0.2:8080")]);
    assert_eq!(parse_pac_result("10.0.0.1:8080 10.0.0.2:8080"), vec![proxy("http://10.0.0.1:8080"), proxy("http://10.0.0.2:8080")]);
    assert_eq!(parse_pac_result("http=a:80;socks=b:1080"), vec![proxy("http://a:80"), proxy("socks5h://b:1080")]);
    assert_eq!(parse_pac_result("PROXY [fd00::1]:3128"), vec![proxy("http://[fd00::1]:3128")]);
    assert_eq!(parse_pac_result("DIRECT"), vec![Hop::Direct]);
    assert_eq!(parse_pac_result("PROXY a:1; PROXY a:1"), vec![proxy("http://a:1")]);
    assert!(parse_pac_result("").is_empty());
    assert!(parse_pac_result("PROXY").is_empty());
    assert!(parse_pac_result("PROXY user@evil:80/path").is_empty());
}

#[test]
fn builds_the_url_a_pac_script_sees_for_each_target() {
    assert_eq!(target_url("https", "imap.qq.com", 993), "https://imap.qq.com:993/");
    assert_eq!(target_url("https", "Mail.Example.COM", 443), "https://mail.example.com/");
    assert_eq!(target_url("http", "example.com", 80), "http://example.com/");
    assert_eq!(target_url("http", "example.com", 443), "http://example.com:443/");
    assert_eq!(target_url("https", "[2001:db8::1]", 465), "https://[2001:db8::1]:465/");
}

#[test]
fn system_settings_prefer_pac_then_manual_proxy_then_wpad() {
    let manual = ProxyTarget {
        url: "http://127.0.0.1:7890".into(),
        bypass: vec!["*.corp".into()],
    };
    let pac = OsProxyConfig {
        auto_detect: true,
        script_url: Some(" http://wpad.corp/proxy.pac ".into()),
        manual: Some(manual.clone()),
    };
    assert_eq!(
        pac.resolved(),
        ResolvedProxy::Auto(AutoProxy {
            pac: PacSource::Script("http://wpad.corp/proxy.pac".into()),
            fallback: Some(manual.clone()),
        })
    );
    let clash = OsProxyConfig {
        auto_detect: true,
        script_url: Some("   ".into()),
        manual: Some(manual.clone()),
    };
    assert_eq!(clash.resolved(), ResolvedProxy::Proxy(manual));
    let wpad = OsProxyConfig {
        auto_detect: true,
        script_url: None,
        manual: None,
    };
    assert_eq!(
        wpad.resolved(),
        ResolvedProxy::Auto(AutoProxy {
            pac: PacSource::Discover,
            fallback: None,
        })
    );
    assert_eq!(OsProxyConfig::default().resolved(), ResolvedProxy::Direct);
}

#[test]
fn reads_pac_and_wpad_flags_from_scutil() {
    let text = "<dictionary> {\n  ExceptionsList : <array> {\n    0 : *.local\n  }\n  HTTPEnable : 0\n  ProxyAutoConfigEnable : 1\n  ProxyAutoConfigURLString : http://pac.corp.example/proxy.pac\n  ProxyAutoDiscoveryEnable : 1\n}\n";
    let config = parse_scutil_config(text);
    assert!(config.auto_detect);
    assert_eq!(config.script_url.as_deref(), Some("http://pac.corp.example/proxy.pac"));
    assert_eq!(config.manual, None);
    let off = parse_scutil_config("<dictionary> {\n  ProxyAutoConfigEnable : 0\n  ProxyAutoConfigURLString : http://pac/x.pac\n}\n");
    assert_eq!(off.script_url, None);
    assert!(!off.auto_detect);
}

#[test]
fn auto_proxy_falls_back_to_the_manual_proxy_or_direct_when_pac_fails() {
    let fallback = ProxyTarget {
        url: "http://10.0.0.9:8080".into(),
        bypass: vec!["*.intranet".into()],
    };
    let auto = AutoProxy {
        pac: PacSource::Script("http://pac/x.pac".into()),
        fallback: Some(fallback),
    };
    assert_eq!(auto.hops_from("imap.qq.com", Some(vec![proxy("http://a:1"), Hop::Direct])), vec![proxy("http://a:1"), Hop::Direct]);
    assert_eq!(auto.hops_from("imap.qq.com", Some(Vec::new())), vec![Hop::Direct]);
    assert_eq!(auto.hops_from("imap.qq.com", None), vec![proxy("http://10.0.0.9:8080")]);
    assert_eq!(auto.hops_from("mail.intranet", None), vec![Hop::Direct]);
    let bare = AutoProxy {
        pac: PacSource::Discover,
        fallback: None,
    };
    assert_eq!(bare.hops_from("imap.qq.com", None), vec![Hop::Direct]);
    assert_eq!(ResolvedProxy::Auto(bare).hops_for("localhost", 993), vec![Hop::Direct]);
}

static CACHE_CALLS: AtomicUsize = AtomicUsize::new(0);
static BROKEN_CALLS: AtomicUsize = AtomicUsize::new(0);

fn counted_answer(_: &PacSource, url: &str) -> Result<String, String> {
    CACHE_CALLS.fetch_add(1, Ordering::SeqCst);
    Ok(if url.contains("imap") { "PROXY p:1; DIRECT".to_string() } else { "DIRECT".to_string() })
}

fn counted_failure(_: &PacSource, _: &str) -> Result<String, String> {
    BROKEN_CALLS.fetch_add(1, Ordering::SeqCst);
    Err("download failed".to_string())
}

fn never_called(_: &PacSource, _: &str) -> Result<String, String> {
    panic!("must not evaluate on the caller's thread")
}

fn no_defer(_: &PacSource, _: &str, _: Evaluator) {
    panic!("must not defer")
}

#[test]
fn caches_pac_answers_per_target_and_failures_only_briefly_per_script() {
    let source = PacSource::Script("http://cache-test.invalid/proxy.pac".into());
    let first = resolve_or_defer(&source, "https://imap.cache.test:993/", Wait::Block, counted_answer, no_defer);
    let second = resolve_or_defer(&source, "https://imap.cache.test:993/", Wait::Block, counted_answer, no_defer);
    let other = resolve_or_defer(&source, "https://www.cache.test/", Wait::Block, counted_answer, no_defer);
    assert_eq!(first, Some(vec![proxy("http://p:1"), Hop::Direct]));
    assert_eq!(second, first);
    assert_eq!(other, Some(vec![Hop::Direct]));
    assert_eq!(CACHE_CALLS.load(Ordering::SeqCst), 2);

    let broken = PacSource::Script("http://broken-test.invalid/proxy.pac".into());
    assert_eq!(resolve_or_defer(&broken, "https://a.test/", Wait::Block, counted_failure, no_defer), None);
    assert_eq!(resolve_or_defer(&broken, "https://b.test/", Wait::Block, counted_failure, no_defer), None);
    assert_eq!(BROKEN_CALLS.load(Ordering::SeqCst), 1);
    assert_eq!(broken.failure_ttl(), Duration::from_secs(30));
    assert_eq!(PacSource::Discover.failure_ttl(), Duration::from_secs(1800));
}

#[test]
fn wpad_and_async_callers_never_evaluate_on_their_own_thread() {
    let deferred = Cell::new(0);
    let defer = |_: &PacSource, _: &str, _: Evaluator| deferred.set(deferred.get() + 1);
    assert_eq!(resolve_or_defer(&PacSource::Discover, "https://imap.wpad-test.test:993/", Wait::Block, never_called, defer), None);
    assert_eq!(deferred.get(), 1);

    let source = PacSource::Script("http://async-test.invalid/proxy.pac".into());
    let url = "https://imap.async.test:993/";
    let mut handed: Option<Evaluator> = None;
    assert_eq!(resolve_or_defer(&source, url, Wait::Cached, counted_answer, |_, _, evaluator| handed = Some(evaluator)), None);
    let evaluator = handed.expect("deferred to the background");
    assert_eq!(evaluate_and_store(&source, url, evaluator), Some(vec![proxy("http://p:1"), Hop::Direct]));
    assert_eq!(resolve_or_defer(&source, url, Wait::Cached, never_called, no_defer), Some(vec![proxy("http://p:1"), Hop::Direct]));
}

fn github_direct_others_proxied(_: &PacSource, url: &str) -> Result<String, String> {
    Ok(if url.contains("github.com") { "DIRECT".to_string() } else { "PROXY corp-proxy:3128; DIRECT".to_string() })
}

fn everything_direct(_: &PacSource, _: &str) -> Result<String, String> {
    Ok("DIRECT".to_string())
}

#[test]
fn a_pac_that_sends_github_direct_still_hands_the_plugin_host_a_proxy() {
    let split = PacSource::Script("http://split-test.invalid/proxy.pac".into());
    let direct = PacSource::Script("http://direct-test.invalid/proxy.pac".into());
    for host in ["github.com", "www.google.com", "api.anthropic.com"] {
        let url = target_url("https", host, 443);
        let _ = evaluate_and_store(&split, &url, github_direct_others_proxied);
        let _ = evaluate_and_store(&direct, &url, everything_direct);
    }
    let auto = |pac: PacSource| ResolvedProxy::Auto(AutoProxy { pac, fallback: None });
    assert_eq!(super::sample_proxy(&auto(split), Wait::Cached).as_deref(), Some("http://corp-proxy:3128"));
    assert_eq!(super::sample_proxy(&auto(direct), Wait::Cached), None);
}

#[test]
fn tries_the_next_hop_when_a_proxy_cannot_be_reached() {
    let dead = TcpListener::bind("127.0.0.1:0").expect("bind");
    let dead_port = dead.local_addr().expect("addr").port();
    drop(dead);
    let target = TcpListener::bind("127.0.0.1:0").expect("bind target");
    let target_port = target.local_addr().expect("addr").port();
    let server = thread::spawn(move || {
        let (mut socket, _) = target.accept().expect("accept");
        socket.write_all(b"OK").expect("write");
    });
    let hops = vec![proxy(&format!("http://127.0.0.1:{dead_port}")), Hop::Direct];
    let connected = connect_hops(&hops, "127.0.0.1", target_port, Duration::from_secs(3)).expect("falls back to direct");
    assert_eq!(connected.proxy, None);
    let mut reply = [0u8; 2];
    let mut stream = connected.stream;
    stream.read_exact(&mut reply).expect("read");
    assert_eq!(&reply, b"OK");
    server.join().expect("server");

    let only = vec![proxy(&format!("http://alice:secret@127.0.0.1:{dead_port}"))];
    let error = connect_hops(&only, "imap.example.com", 993, Duration::from_secs(3)).err().expect("unreachable");
    let found = connect_fault(&error).expect("typed");
    assert_eq!(found.fault, ConnectFault::ProxyUnreachable);
    assert_eq!(found.proxy.as_deref(), Some(format!("http://127.0.0.1:{dead_port}").as_str()));
}

fn proxy_answering(reply: &'static [u8]) -> (u16, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind proxy");
    let port = listener.local_addr().expect("addr").port();
    let server = thread::spawn(move || {
        let (mut socket, _) = listener.accept().expect("accept");
        let mut buffer = [0u8; 512];
        let _ = socket.read(&mut buffer);
        let _ = socket.write_all(reply);
    });
    (port, server)
}

fn fault_through(reply: &'static [u8]) -> ConnectFault {
    let (port, server) = proxy_answering(reply);
    let hops = vec![proxy(&format!("http://127.0.0.1:{port}"))];
    let error = connect_hops(&hops, "imap.example.com", 993, Duration::from_secs(3)).err().expect("fails");
    server.join().expect("server");
    connect_fault(&error).expect("typed").fault
}

#[test]
fn tells_apart_each_way_an_http_proxy_can_refuse_the_tunnel() {
    assert_eq!(fault_through(b"HTTP/1.1 403 Forbidden\r\n\r\n"), ConnectFault::ProxyRefused);
    assert_eq!(fault_through(b"HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm=\"corp\"\r\n\r\n"), ConnectFault::ProxyAuth);
    assert_eq!(
        fault_through(b"HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Negotiate\r\nProxy-Authenticate: NTLM\r\n\r\n"),
        ConnectFault::ProxyAuthDomain
    );
    assert_eq!(fault_through(b"HTTP/1.1 502 Bad Gateway\r\n\r\n"), ConnectFault::ProxyUpstream);
    assert_eq!(fault_through(b""), ConnectFault::ProxyClosed);
    assert_eq!(fault_through(b"\x05\x00garbage\r\n\r\n"), ConnectFault::ProxyBadReply);
}

#[test]
fn parses_connect_replies_and_socks_codes() {
    assert_eq!(parse_connect_status("HTTP/1.0 200 Connection established\r\n\r\n"), Some(200));
    assert_eq!(parse_connect_status("SSH-2.0-OpenSSH\r\n"), None);
    assert_eq!(
        proxy_authenticate_schemes("HTTP/1.1 407 x\r\nproxy-authenticate: NTLM\r\nProxy-Authenticate: Negotiate abc\r\nVia: x\r\n\r\n"),
        vec!["NTLM".to_string(), "Negotiate".to_string()]
    );
    assert_eq!(connect_status_fault(407, &[]), ConnectFault::ProxyAuth);
    assert_eq!(connect_status_fault(407, &["NTLM".into(), "Basic".into()]), ConnectFault::ProxyAuth);
    assert_eq!(connect_status_fault(405, &[]), ConnectFault::ProxyRefused);
    assert_eq!(connect_status_fault(504, &[]), ConnectFault::ProxyUpstream);
    assert_eq!(socks5_reply_fault(0x02).0, ConnectFault::ProxyRefused);
    assert_eq!(socks5_reply_fault(0x04).0, ConnectFault::ProxyUpstream);
    assert_eq!(socks5_reply_fault(0x08).0, ConnectFault::ProxyBadReply);
}

#[test]
fn refused_socks_rules_are_reported_as_a_blocked_port() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind socks");
    let port = listener.local_addr().expect("addr").port();
    let server = thread::spawn(move || {
        let (mut socket, _) = listener.accept().expect("accept");
        let mut greet = [0u8; 3];
        socket.read_exact(&mut greet).expect("greet");
        socket.write_all(&[0x05, 0x00]).expect("no auth");
        let mut head = [0u8; 5];
        socket.read_exact(&mut head).expect("head");
        let mut rest = vec![0u8; usize::from(head[4]) + 2];
        socket.read_exact(&mut rest).expect("rest");
        socket.write_all(&[0x05, 0x02, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).expect("refuse");
    });
    let hops = vec![proxy(&format!("socks5h://127.0.0.1:{port}"))];
    let error = connect_hops(&hops, "imap.example.com", 993, Duration::from_secs(3)).err().expect("refused");
    assert_eq!(connect_fault(&error).expect("typed").fault, ConnectFault::ProxyRefused);
    server.join().expect("server");
}

#[test]
fn an_unknown_mail_host_is_a_dns_failure() {
    if let Err(error) = connect_hops(&[Hop::Direct], "no-such-host.invalid", 993, Duration::from_secs(3)) {
        assert_eq!(connect_fault(&error).map(|found| found.fault), Some(ConnectFault::Dns));
    }
}

#[test]
fn tries_ipv4_addresses_before_ipv6() {
    let v6: SocketAddr = "[2001:db8::1]:993".parse().expect("v6");
    let v4: SocketAddr = "192.0.2.1:993".parse().expect("v4");
    assert_eq!(order_addresses(vec![v6, v4].into_iter()), vec![v4, v6]);
}
