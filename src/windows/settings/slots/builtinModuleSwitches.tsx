import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { isBuiltinEnabled, switchBuiltinPlugin } from "../../../features/plugin-kernel/builtinSwitches";
import { islandItemStyleId, islandItemStyles } from "../../../features/plugin-kernel/settingsSlots";
import { useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import { useTranslation } from "../../../i18n";
import type { BuiltinPluginName } from "../../../i18n/sections/settings/pluginsV3";
import { settingsSections } from "./sectionSlot";

type ModuleCategory = "generalApi" | "agentRings" | "agentPush" | "agentRemote";

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

function LocalApiOff() {
  const t = useTranslation().settings;
  return <ModuleOffCard pluginId="local-api" title={t.localApi.title} description={t.pluginsV3.builtinSummaries["local-api"]} footer={t.localApi.hint} />;
}

function CenterPatternOff() {
  const t = useTranslation().settings;
  const plugins = useBuiltinPlugins();
  if (isBuiltinEnabled(plugins, "center-pattern")) return null;
  return (
    <SettingsToggleRow
      searchable={false}
      title={t.plugins.centerPattern.group}
      description={t.pluginsV3.builtinSummaries["center-pattern"]}
      checked={false}
      onChange={(on) => void switchBuiltinPlugin("center-pattern", on).catch(() => undefined)}
    />
  );
}

function ClaudeUsageOff() {
  const t = useTranslation();
  return <ModuleOffCard pluginId="claude-usage" title={t.claudeUsage.settings.title} description={t.settings.pluginsV3.builtinSummaries["claude-usage"]} footer={t.claudeUsage.settings.footer} />;
}

function SessionRingOff() {
  const t = useTranslation();
  return <ModuleOffCard pluginId="session-ring" title={t.sessionRing.settings.title} description={t.settings.pluginsV3.builtinSummaries["session-ring"]} footer={t.sessionRing.settings.footer} />;
}

function CcConnectOff() {
  const t = useTranslation().settings;
  return <ModuleOffCard pluginId="cc-connect" title={t.plugins.ccConnect.group} description={t.pluginsV3.builtinSummaries["cc-connect"]} footer={t.plugins.ccConnect.groupHint} />;
}

function SshTunnelOff() {
  const t = useTranslation().settings;
  return <ModuleOffCard pluginId="ssh-tunnel" title={t.plugins.sshTunnel.group} description={t.pluginsV3.builtinSummaries["ssh-tunnel"]} footer={t.plugins.sshTunnel.groupHint} />;
}

const sections = settingsSections<object, ModuleCategory>();

sections.add({ id: "generalApi.localApi.off", category: "generalApi", order: 10, component: LocalApiOff });
sections.add({ id: "agents.usage.off", category: "agentRings", order: 40, component: ClaudeUsageOff });
sections.add({ id: "agents.session-ring.off", category: "agentRings", order: 45, component: SessionRingOff });
sections.add({ id: "agentAlerts.ccConnect.off", category: "agentPush", order: 30, component: CcConnectOff });
sections.add({ id: "agentRemote.ssh-tunnel.off", category: "agentRemote", order: 20, component: SshTunnelOff });
islandItemStyles.add({ id: islandItemStyleId("center", "off"), category: "islandLayout", order: 10, component: CenterPatternOff });
