use std::io;

use super::net_error::{classify, signal_of, user_error, Endpoint, Signal, Stage};
use super::session::MailFailure;
use crate::system::proxy::tunnel::fault;
use crate::system::proxy::ConnectFault;

const QQ: Endpoint = Endpoint {
    host: "imap.qq.com",
    port: 993,
    proxy: None,
};
const QQ_VIA_PROXY: Endpoint = Endpoint {
    host: "imap.qq.com",
    port: 993,
    proxy: Some("http://10.0.0.1:8080"),
};

fn code(stage: Stage, signal: Signal, endpoint: &Endpoint) -> Option<&'static str> {
    user_error(stage, signal, endpoint, endpoint.proxy).map(|error| error.code())
}

#[test]
fn the_fb35_reset_reads_as_a_firewall_or_proxy_problem_not_a_generic_sync_failure() {
    let windows_text = io::Error::other("An existing connection was forcibly closed by the remote host. (os error 10054)");
    let direct = MailFailure::network("TLS", Stage::Tls, &windows_text, &QQ);
    assert_eq!(direct.error.code(), "mail.resetDirect");
    assert!(!direct.authentication);
    assert!(direct.error.to_string().ends_with("TLS: An existing connection was forcibly closed by the remote host. (os error 10054)"));
    let proxied = MailFailure::network("TLS", Stage::Tls, &windows_text, &QQ_VIA_PROXY);
    assert_eq!(proxied.error.code(), "mail.proxyClosed");
    let greeting = MailFailure::network("GREETING", Stage::Greeting, &io::Error::from(io::ErrorKind::UnexpectedEof), &QQ_VIA_PROXY);
    assert_eq!(greeting.error.code(), "mail.proxyClosed");
}

#[test]
fn reads_the_signal_from_io_kinds_os_codes_and_tls_wording() {
    assert_eq!(signal_of(&io::Error::from(io::ErrorKind::ConnectionReset)).0, Signal::Reset);
    assert_eq!(signal_of(&io::Error::from(io::ErrorKind::WouldBlock)).0, Signal::Timeout);
    assert_eq!(signal_of(&io::Error::from(io::ErrorKind::ConnectionRefused)).0, Signal::Refused);
    assert_eq!(signal_of(&io::Error::from(io::ErrorKind::NetworkUnreachable)).0, Signal::Unreachable);
    assert_eq!(signal_of(&io::Error::other("A connection attempt failed (os error 10060)")).0, Signal::Timeout);
    assert_eq!(signal_of(&io::Error::other("No connection could be made (os error 10061)")).0, Signal::Refused);
    assert_eq!(
        signal_of(&io::Error::other("The certificate chain was issued by an authority that is not trusted. (os error -2146893019)")).0,
        Signal::Certificate
    );
    assert_eq!(signal_of(&io::Error::other("The revocation function was unable to check revocation (os error -2146885613)")).0, Signal::Certificate);
    assert_eq!(signal_of(&io::Error::other("error:0A000086:SSL routines::certificate verify failed")).0, Signal::Certificate);
    assert_eq!(signal_of(&io::Error::other("connection closed via error")).0, Signal::Reset);
    assert_eq!(signal_of(&io::Error::other("No Response: invalid password")).0, Signal::Other);
}

#[test]
fn a_typed_connect_fault_wins_and_names_the_proxy() {
    let error = fault(ConnectFault::ProxyRefused, Some("http://bob:pw@10.0.0.1:8080"), io::ErrorKind::PermissionDenied, "HTTP 403");
    let (signal, proxy) = signal_of(&error);
    assert_eq!(signal, Signal::Fault(ConnectFault::ProxyRefused));
    assert_eq!(proxy.as_deref(), Some("http://10.0.0.1:8080"));
    let refused = classify(Stage::Connect, &error, &QQ).expect("classified");
    assert_eq!(refused.code(), "mail.proxyPortBlocked");
    let unreachable = fault(ConnectFault::ProxyUnreachable, Some("http://127.0.0.1:7890"), io::ErrorKind::ConnectionRefused, "refused");
    let error = classify(Stage::Connect, &unreachable, &QQ).expect("classified");
    assert_eq!(error.code(), "mail.proxyUnreachable");
    let payload = serde_json::to_value(&error).expect("json");
    assert_eq!(payload["args"]["proxy"], "http://127.0.0.1:7890");
}

#[test]
fn every_failure_kind_has_its_own_code() {
    let cases = [
        (Stage::Connect, Signal::Fault(ConnectFault::Dns), &QQ, Some("mail.dns")),
        (Stage::Connect, Signal::Fault(ConnectFault::ProxyAuth), &QQ, Some("mail.proxyAuth")),
        (Stage::Connect, Signal::Fault(ConnectFault::ProxyAuthDomain), &QQ, Some("mail.proxyAuthDomain")),
        (Stage::Connect, Signal::Fault(ConnectFault::ProxyRefused), &QQ, Some("mail.proxyPortBlocked")),
        (Stage::Connect, Signal::Fault(ConnectFault::ProxyUpstream), &QQ, Some("mail.proxyUpstream")),
        (Stage::Connect, Signal::Fault(ConnectFault::ProxyClosed), &QQ, Some("mail.proxyClosed")),
        (Stage::Connect, Signal::Fault(ConnectFault::ProxyBadReply), &QQ, Some("mail.proxyBadReply")),
        (Stage::Connect, Signal::Timeout, &QQ, Some("mail.portBlocked")),
        (Stage::Connect, Signal::Refused, &QQ, Some("mail.portBlocked")),
        (Stage::Connect, Signal::Unreachable, &QQ, Some("mail.offline")),
        (Stage::Connect, Signal::Certificate, &QQ, None),
        (Stage::Tls, Signal::Certificate, &QQ, Some("mail.tlsCert")),
        (Stage::Tls, Signal::Certificate, &QQ_VIA_PROXY, Some("mail.tlsCert")),
        (Stage::Tls, Signal::Reset, &QQ, Some("mail.resetDirect")),
        (Stage::Tls, Signal::Reset, &QQ_VIA_PROXY, Some("mail.proxyClosed")),
        (Stage::Tls, Signal::Timeout, &QQ, Some("mail.timeout")),
        (Stage::Greeting, Signal::Timeout, &QQ_VIA_PROXY, Some("mail.timeout")),
        (Stage::Tls, Signal::Refused, &QQ, None),
        (Stage::Tls, Signal::Other, &QQ, None),
    ];
    for (stage, signal, endpoint, expected) in cases {
        assert_eq!(code(stage, signal, endpoint), expected, "{stage:?} {signal:?} via {:?}", endpoint.proxy);
    }
}

#[test]
fn unclassified_failures_keep_the_generic_sync_code_and_detail() {
    let failure = MailFailure::network("TLS", Stage::Tls, &io::Error::other("handshake went sideways"), &QQ);
    assert_eq!(failure.error.code(), "mail.sync");
    assert!(failure.error.to_string().ends_with("TLS: handshake went sideways"));
}

#[test]
fn blocked_port_wording_carries_host_and_port() {
    let error = user_error(Stage::Connect, Signal::Timeout, &QQ, None).expect("classified");
    let payload = serde_json::to_value(&error).expect("json");
    assert_eq!(payload["code"], "mail.portBlocked");
    assert_eq!(payload["args"]["host"], "imap.qq.com");
    assert_eq!(payload["args"]["port"], 993);
}
