use std::{
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs},
    sync::Arc,
};

use reqwest::{
    dns::{Addrs, Name, Resolve, Resolving},
    Url,
};

pub(super) fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_v4(ip),
        IpAddr::V6(ip) => match ip.to_ipv4_mapped() {
            Some(v4) => is_public_v4(v4),
            None => is_public_v6(ip),
        },
    }
}

fn is_public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_multicast()
        || a == 0
        || a >= 240
        || (a == 100 && (64..128).contains(&b))
        || (a == 198 && (b == 18 || b == 19)))
}

fn is_public_v6(ip: Ipv6Addr) -> bool {
    let first = ip.segments()[0];
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        || (first & 0xfe00) == 0xfc00
        || (first & 0xffc0) == 0xfe80
        || (first == 0x2001 && ip.segments()[1] == 0x0db8))
}

pub(super) fn allowed_url(url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    let Some(host) = url.host_str() else { return false };
    if let Ok(ip) = host.trim_start_matches('[').trim_end_matches(']').parse::<IpAddr>() {
        return is_public_ip(ip);
    }
    let name = host.trim_end_matches('.').to_ascii_lowercase();
    name.contains('.') && ![".localhost", ".local", ".internal", ".lan", ".home.arpa"].iter().any(|suffix| name.ends_with(suffix))
}

struct PublicOnly;

impl Resolve for PublicOnly {
    fn resolve(&self, name: Name) -> Resolving {
        let host = name.as_str().to_string();
        Box::pin(async move {
            let found = tauri::async_runtime::spawn_blocking(move || (host.as_str(), 0).to_socket_addrs().map(Iterator::collect::<Vec<SocketAddr>>))
                .await
                .map_err(|error| Box::new(std::io::Error::other(error.to_string())) as Box<dyn std::error::Error + Send + Sync>)??;
            let public: Vec<SocketAddr> = found.into_iter().filter(|address| is_public_ip(address.ip())).collect();
            if public.is_empty() {
                return Err("The link points to this computer or the local network.".into());
            }
            Ok(Box::new(public.into_iter()) as Addrs)
        })
    }
}

pub(super) fn client(timeout: std::time::Duration, user_agent: &str) -> Result<reqwest::Client, String> {
    let redirects = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= 5 {
            attempt.error("too many redirects")
        } else if allowed_url(attempt.url()) {
            attempt.follow()
        } else {
            attempt.stop()
        }
    });
    reqwest::Client::builder()
        .timeout(timeout)
        .redirect(redirects)
        .no_proxy()
        .dns_resolver(Arc::new(PublicOnly))
        .user_agent(user_agent)
        .build()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{allowed_url, is_public_ip};
    use reqwest::Url;

    #[test]
    fn local_and_private_addresses_are_not_visited() {
        for ip in ["127.0.0.1", "10.0.0.8", "192.168.1.1", "172.16.4.2", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:192.168.1.1"] {
            assert!(!is_public_ip(ip.parse().expect("ip")), "{ip}");
        }
        for ip in ["1.1.1.1", "140.82.112.3", "2606:4700::1111"] {
            assert!(is_public_ip(ip.parse().expect("ip")), "{ip}");
        }
        let allowed = |url: &str| allowed_url(&Url::parse(url).expect("url"));
        assert!(allowed("https://github.com/TixXin/fuyu"));
        assert!(!allowed("http://localhost:1420/"));
        assert!(!allowed("http://router.lan/"));
        assert!(!allowed("http://nas/"));
        assert!(!allowed("http://192.168.1.1/admin"));
        assert!(!allowed("http://[::1]:8080/"));
        assert!(!allowed("file:///C:/Windows/win.ini"));
    }
}
