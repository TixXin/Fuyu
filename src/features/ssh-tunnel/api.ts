import { invoke } from "@tauri-apps/api/core";

export const SSH_TUNNEL_PLUGIN_ID = "focusd.ssh-proxy-tunnel";

export type SshTunnelState = "off" | "connecting" | "connected" | "portInUse" | "error";

export type SshTunnelHost = {
  host: string;
  enabled: boolean;
  remotePort: number | null;
  state: SshTunnelState;
  error: string | null;
};

export function getSshTunnels() {
  return invoke<SshTunnelHost[]>("get_ssh_tunnels");
}

export function setSshTunnel(host: string, enabled: boolean, remotePort: number | null) {
  return invoke<SshTunnelHost[]>("set_ssh_tunnel", { host, enabled, remotePort });
}

export function checkSshTunnelPort(host: string, remotePort: number) {
  return invoke<boolean>("check_ssh_tunnel_port", { host, remotePort });
}

export type SshTunnelProxy = {
  port: number;
  found: "clashVerge" | "v2rayN" | "systemProxy" | "clashVergeDefault" | "v2rayNDefault" | "custom";
  listening: boolean;
};

export function getSshTunnelProxy() {
  return invoke<SshTunnelProxy | null>("get_ssh_tunnel_proxy");
}
