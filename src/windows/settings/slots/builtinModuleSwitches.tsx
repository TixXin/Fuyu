import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { LocalApiPageView } from "../../../features/local-api/LocalApiPageView";
import { isBuiltinEnabled, switchBuiltinPlugin } from "../../../features/plugin-kernel/builtinSwitches";
import type { SettingsLink } from "../../../features/plugin-kernel/settingsCategories";
import { islandItemStyleId, islandItemStyles } from "../../../features/plugin-kernel/settingsSlots";
import { useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import { useTranslation } from "../../../i18n";
import type { BuiltinPluginName } from "../../../i18n/sections/settings/pluginHost";
import { settingsSections } from "./sectionSlot";

type ModuleCategory = "generalApi" | "agentRings" | "agentPush" | "agentRemote";

const noop = () => undefined;

function ModuleOffCard({
  pluginId,
  title,
  description,
  footer,
}: {
  pluginId: BuiltinPluginName;
  title: string;
  description: string;
  footer?: string;
}) {
  const plugins = useBuiltinPlugins();
  if (isBuiltinEnabled(plugins, pluginId)) return null;
  return (
    <SettingsGroup title={title} footer={footer ? <SettingsFootnote text={footer} /> : undefined}>
      <SettingsToggleRow
        searchable={false}
        title={title}
        description={description}
        checked={false}
        onChange={(on) => void switchBuiltinPlugin(pluginId, on).catch(() => undefined)}
      />
    </SettingsGroup>
  );
}

function LocalApiOff({ onOpenPage }: { onOpenPage?: (page: SettingsLink) => void }) {
  const plugins = useBuiltinPlugins();
  if (isBuiltinEnabled(plugins, "local-api")) return null;
  const plugin = plugins?.find((item) => item.id === "local-api");
  return (
    <LocalApiPageView
      enabled={false}
      info={null}
      error={null}
      failure={null}
      allowWrite={plugin?.config.allowWrite === true}
      allowNotify={plugin?.config.allowNotify === true}
      copied={null}
      onToggleEnabled={(on) => void switchBuiltinPlugin("local-api", on).catch(() => undefined)}
      onAllowWriteChange={noop}
      onAllowNotifyChange={noop}
      onCopyAddress={noop}
      onCopyToken={noop}
      onResetToken={noop}
      onRevealConfig={noop}
      onOpenDocs={noop}
      onOpenPage={onOpenPage ?? noop}
    />
  );
}

function CenterPatternOff() {
  const t = useTranslation().settings;
  const plugins = useBuiltinPlugins();
  if (isBuiltinEnabled(plugins, "center-pattern")) return null;
  return (
    <SettingsToggleRow
      searchable={false}
      title={t.plugins.centerPattern.group}
      description={t.pluginHost.builtinSummaries["center-pattern"]}
      checked={false}
      onChange={(on) => void switchBuiltinPlugin("center-pattern", on).catch(() => undefined)}
    />
  );
}

function ClaudeUsageOff() {
  const t = useTranslation();
  return <ModuleOffCard pluginId="claude-usage" title={t.claudeUsage.settings.title} description={t.settings.pluginHost.builtinSummaries["claude-usage"]} footer={t.claudeUsage.settings.footer} />;
}

function SessionRingOff() {
  const t = useTranslation();
  return <ModuleOffCard pluginId="session-ring" title={t.sessionRing.settings.title} description={t.settings.pluginHost.builtinSummaries["session-ring"]} footer={t.sessionRing.settings.footer} />;
}

function CcConnectOff() {
  const t = useTranslation().settings;
  return <ModuleOffCard pluginId="cc-connect" title={t.plugins.ccConnect.group} description={t.pluginHost.builtinSummaries["cc-connect"]} footer={t.plugins.ccConnect.groupHint} />;
}

function SshTunnelOff() {
  const t = useTranslation().settings;
  return <ModuleOffCard pluginId="ssh-tunnel" title={t.plugins.sshTunnel.group} description={t.pluginHost.builtinSummaries["ssh-tunnel"]} footer={t.plugins.sshTunnel.groupHint} />;
}

const sections = settingsSections<object, ModuleCategory>();

sections.add({ id: "generalApi.localApi.off", category: "generalApi", order: 10, component: LocalApiOff });
sections.add({ id: "agents.usage.off", category: "agentRings", order: 40, component: ClaudeUsageOff });
sections.add({ id: "agents.session-ring.off", category: "agentRings", order: 45, component: SessionRingOff });
sections.add({ id: "agentAlerts.ccConnect.off", category: "agentPush", order: 30, component: CcConnectOff });
sections.add({ id: "agentRemote.ssh-tunnel.off", category: "agentRemote", order: 20, component: SshTunnelOff });
islandItemStyles.add({ id: islandItemStyleId("center", "off"), category: "islandLayout", order: 10, component: CenterPatternOff });
