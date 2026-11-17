import { Network } from "lucide-react";
import { useState } from "react";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import { switchBuiltinPlugin } from "../../../features/plugin-kernel/builtinSwitches";
import { useBuiltinEnabled } from "../../../features/plugin-kernel/useBuiltinPlugins";
import type { SshTunnelHost } from "../../../features/ssh-tunnel/api";
import { OWNER as SSH_TUNNEL_PLUGIN } from "../../../features/ssh-tunnel/plugin/owner";
import { useSshTunnels } from "../../../features/ssh-tunnel/useSshTunnels";
import { useErrorText, useTranslation } from "../../../i18n";

const DEFAULT_PORT = 37897;

export function PushTunnels({ hosts }: { hosts: readonly string[] }) {
  const t = useTranslation();
  const text = t.onboarding.push.tunnel;
  const states = t.settings.plugins.sshTunnel;
  const errorText = useErrorText();
  const enabled = useBuiltinEnabled(SSH_TUNNEL_PLUGIN);
  const tunnels = useSshTunnels();
  const [error, setError] = useState<string | null>(null);
  const entries = hosts.flatMap((host) => tunnels.hosts?.find((entry) => entry.host === host) ?? []);
  if (entries.length === 0) return null;

  const toggle = (entry: SshTunnelHost, on: boolean) => {
    setError(null);
    const ready = on && !enabled ? switchBuiltinPlugin(SSH_TUNNEL_PLUGIN, true) : Promise.resolve();
    ready.then(() => tunnels.toggle(entry, on, entry.remotePort ?? DEFAULT_PORT)).catch((reason: unknown) => setError(errorText(reason)));
  };
  const describe = (entry: SshTunnelHost) => {
    if (tunnels.checking === entry.host) return states.checking;
    if (!entry.enabled) return text.off;
    const state = enabled ? states.state[entry.state] : states.waitingForPlugin;
    return `${state} · ${text.port(entry.remotePort ?? DEFAULT_PORT)}`;
  };

  return (
    <>
      <p className="push-act__lead">{text.lead}</p>
      <ul className="push-act__list">
        {entries.map((entry) => (
          <li key={entry.host} className="push-act__row" data-tunnel={entry.host}>
            <Network size={15} aria-hidden="true" className="push-act__icon" />
            <div className="push-act__main">
              <label className="push-act__name" htmlFor={`push-tunnel-${entry.host}`}>
                {entry.host}
              </label>
              <span className="push-act__note">{describe(entry)}</span>
              {tunnels.taken?.host === entry.host ? (
                <div className="push-act__inline">
                  <span className="push-act__note">
                    {tunnels.taken.unchecked === null ? states.confirm(entry.host, tunnels.taken.port) : states.unchecked(entry.host, tunnels.taken.port, tunnels.taken.unchecked)}
                  </span>
                  <SettingsLinkButton onClick={() => tunnels.answer(true)}>{states.yes}</SettingsLinkButton>
                  <SettingsLinkButton onClick={() => tunnels.answer(false)}>{states.no}</SettingsLinkButton>
                </div>
              ) : null}
            </div>
            <SettingsSwitch id={`push-tunnel-${entry.host}`} checked={entry.enabled} disabled={tunnels.checking === entry.host} onChange={(on) => toggle(entry, on)} />
          </li>
        ))}
      </ul>
      {error || tunnels.error ? <p className="push-act__error">{error || tunnels.error}</p> : null}
    </>
  );
}
