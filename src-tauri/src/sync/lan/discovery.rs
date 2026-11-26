use mdns_sd::{ResolvedService, ScopedIp, ServiceDaemon, ServiceEvent, ServiceInfo};
use std::{
    net::{IpAddr, SocketAddr},
    thread,
};

pub(crate) const SERVICE_TYPE: &str = "_fuyu._tcp.local.";
const PROTOCOL: &str = "1";

pub(crate) enum Seen {
    Found { id: String, name: String, addr: SocketAddr },
    Lost { id: String },
}

pub(crate) struct Discovery {
    daemon: ServiceDaemon,
    fullname: String,
}

impl Drop for Discovery {
    fn drop(&mut self) {
        let _ = self.daemon.unregister(&self.fullname);
        let _ = self.daemon.shutdown();
    }
}

fn failed(error: mdns_sd::Error) -> String {
    format!("Could not announce this device on the local network: {error}")
}

pub(crate) fn start(device_id: &str, name: &str, port: u16, on_seen: impl Fn(Seen) + Send + 'static) -> Result<Discovery, String> {
    let daemon = ServiceDaemon::new().map_err(failed)?;
    let host_name = format!("fuyu-{}.local.", device_id.chars().take(12).collect::<String>());
    let name: String = name.chars().filter(|ch| !ch.is_control()).take(64).collect();
    let properties = [("id", device_id), ("v", PROTOCOL), ("n", name.as_str())];
    let info = ServiceInfo::new(SERVICE_TYPE, device_id, &host_name, "", port, &properties[..]).map_err(failed)?.enable_addr_auto();
    let fullname = info.get_fullname().to_string();
    daemon.register(info).map_err(failed)?;
    let events = daemon.browse(SERVICE_TYPE).map_err(failed)?;
    let own = device_id.to_string();
    thread::Builder::new()
        .name("fuyu-lan-browse".into())
        .spawn(move || {
            while let Ok(event) = events.recv() {
                match event {
                    ServiceEvent::ServiceResolved(service) => {
                        if let Some(seen) = resolved(&own, &service) {
                            on_seen(seen);
                        }
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        if let Some(id) = fullname.strip_suffix(&format!(".{SERVICE_TYPE}")).filter(|id| *id != own && crate::sync::device::is_valid_id(id)) {
                            on_seen(Seen::Lost { id: id.to_string() });
                        }
                    }
                    _ => {}
                }
            }
        })
        .map_err(|error| error.to_string())?;
    Ok(Discovery { daemon, fullname })
}

fn resolved(own: &str, service: &ResolvedService) -> Option<Seen> {
    if service.get_property_val_str("v") != Some(PROTOCOL) {
        return None;
    }
    let id = service.get_property_val_str("id")?;
    if id == own || !crate::sync::device::is_valid_id(id) {
        return None;
    }
    let ip = pick_address(service.get_addresses().iter().map(ScopedIp::to_ip_addr))?;
    let name = service.get_property_val_str("n").unwrap_or_default().to_string();
    Some(Seen::Found { id: id.to_string(), name, addr: SocketAddr::new(ip, service.port) })
}

fn rank(ip: &IpAddr) -> Option<u8> {
    match ip {
        IpAddr::V4(v4) if v4.is_loopback() || v4.is_unspecified() || v4.is_link_local() => None,
        IpAddr::V4(v4) if v4.is_private() => Some(0),
        IpAddr::V4(_) => Some(1),
        IpAddr::V6(v6) if v6.is_loopback() || v6.is_unspecified() || (v6.segments()[0] & 0xffc0) == 0xfe80 => None,
        IpAddr::V6(_) => Some(2),
    }
}

pub(crate) fn pick_address(addrs: impl Iterator<Item = IpAddr>) -> Option<IpAddr> {
    addrs.filter_map(|ip| rank(&ip).map(|rank| (rank, ip))).min().map(|(_, ip)| ip)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(text: &str) -> IpAddr {
        text.parse().unwrap()
    }

    #[test]
    fn private_ipv4_wins_and_loopback_or_link_local_is_skipped() {
        let all = [ip("127.0.0.1"), ip("fe80::1"), ip("2001:db8::5"), ip("100.64.0.9"), ip("192.168.1.20"), ip("169.254.3.3")];
        assert_eq!(pick_address(all.into_iter()), Some(ip("192.168.1.20")));
        assert_eq!(pick_address([ip("2001:db8::5"), ip("fe80::1")].into_iter()), Some(ip("2001:db8::5")));
        assert_eq!(pick_address([ip("127.0.0.1"), ip("::1")].into_iter()), None);
    }
}
