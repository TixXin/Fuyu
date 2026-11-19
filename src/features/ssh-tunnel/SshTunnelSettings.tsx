import { useId } from "react";
import { Check, Copy } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useFlash } from "../../components/settings/useFlash";
import { useErrorText, useTranslation } from "../../i18n";
import { setBuiltinConfig, switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { OWNER } from "./plugin/owner.ts";
import { SshTunnelHosts } from "./SshTunnelHosts";
import { customPortSetting, DEFAULT_CUSTOM_PORT, LOCAL_PROXIES, localProxySetting } from "./tunnelConfig";
import { useSshTunnelProxy } from "./useSshTunnelProxy";

export function SshTunnelSettings() {
  const text = useTranslation().settings.plugins;
  const t = text.sshTunnel;
  const errorText = useErrorText();
  const config = useBuiltinConfig(OWNER);
  const localProxy = localProxySetting(config);
  const customPort = customPortSetting(config);
  const proxy = useSshTunnelProxy(true);
  const switchId = useId();
  const [copied, flashCopied] = useFlash<"proxy">();
  const [failure, flashFailure] = useFlash<string>();

  const save = (key: "localProxy" | "customPort", value: string | number | null) => {
    void setBuiltinConfig(OWNER, key, value).catch((reason: unknown) => flashFailure(errorText(reason)));
  };

  const options = LOCAL_PROXIES.map((value) => ({ value, label: t.localProxyOptions[value] }));
  const proxyDescription = proxy ? (
    <span className="ssh-tunnel__proxy-status">
      <code className="ssh-tunnel__proxy-code">{`127.0.0.1:${proxy.port}`}</code>
      {" · "}
      <span className={proxy.listening ? undefined : "ssh-tunnel__error"}>
        {t.proxy.found[proxy.found]}
        {proxy.listening ? t.proxy.listening : t.proxy.notListening}
      </span>
    </span>
  ) : (
    t.proxy.looking
  );

  return (
    <>
      <SettingsGroup
        title={t.group}
        action={<SettingsSwitch id={switchId} ariaLabel={t.group} checked onChange={(on) => void switchBuiltinPlugin(OWNER, on).catch((reason: unknown) => flashFailure(errorText(reason)))} />}
        footer={failure ? <span className="ssh-tunnel__error">{failure}</span> : <SettingsFootnote text={t.groupHint} />}
      >
        <SettingsRow
          title={t.localProxy}
          description={t.localProxyHint}
          control={<SettingsSelect value={localProxy} options={options} ariaLabel={t.localProxy} onChange={(next) => save("localProxy", next === "auto" ? null : next)} />}
        />
        {localProxy === "custom" ? (
          <SettingsNumberRow
            indent
            title={t.customPort}
            value={customPort}
            min={1}
            max={65535}
            onChange={(port) => save("customPort", port === DEFAULT_CUSTOM_PORT ? null : port)}
          />
        ) : null}
        <SettingsRow
          searchable={false}
          title={t.proxy.current}
          description={proxyDescription}
          control={
            proxy ? (
              <SettingsLinkButton onClick={() => void navigator.clipboard.writeText(`127.0.0.1:${proxy.port}`).then(() => flashCopied("proxy"))}>
                {copied === "proxy" ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />}{" "}
                {copied === "proxy" ? text.detail.copied : text.detail.copy}
              </SettingsLinkButton>
            ) : null
          }
        />
      </SettingsGroup>
      <SshTunnelHosts />
    </>
  );
}
