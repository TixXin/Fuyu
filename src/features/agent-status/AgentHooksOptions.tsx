import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInlineConfirm } from "../../components/settings/SettingsInlineConfirm";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { useDevBuild } from "../../lib/platform";
import type { IslandSettings } from "../../lib/settings/types";
import { RemoteResultLines } from "./RemoteResultLines";
import type { AgentStatusSettings } from "./useAgentStatusSettings";

export function AgentHooksOptions({
  settings,
  onSettingsChange,
  bulkHooks,
  onReinstallAll,
  onRemoveAll,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
} & Pick<AgentStatusSettings, "bulkHooks" | "onReinstallAll" | "onRemoveAll">) {
  const t = useTranslation().settings.agent;
  const text = t.hooks;
  const devBuild = useDevBuild();
  const working = bulkHooks.state === "working";
  const result = (kind: "reinstall" | "remove") =>
    bulkHooks.kind !== kind ? null : bulkHooks.state === "error" ? (
      <span className="agent-hooks-message agent-hooks-message--error" role="alert">{bulkHooks.error}</span>
    ) : bulkHooks.state === "done" ? (
      <span className="agent-hooks-message" role="status">
        <span>
          {kind === "reinstall" ? text.reinstalledAll : t.hooksRemoved}
          <RemoteResultLines results={bulkHooks.remotes} />
        </span>
      </span>
    ) : null;

  return (
    <SettingsGroup title={text.optionsSection}>
      <SettingsToggleRow
        title={text.autoInstall}
        description={text.autoInstallHint}
        checked={settings.agentHooksAutoInstall}
        onChange={(agentHooksAutoInstall) => onSettingsChange({ ...settings, agentHooksAutoInstall })}
      />
      <SettingsToggleRow
        title={text.autoUpdate}
        description={text.autoUpdateHint}
        checked={settings.agentHooksAutoUpdate}
        onChange={(agentHooksAutoUpdate) => onSettingsChange({ ...settings, agentHooksAutoUpdate })}
      />
      <SettingsRow
        title={text.reinstallAll}
        description={text.reinstallAllHint}
        control={
          <SettingsLinkButton disabled={working} onClick={onReinstallAll}>
            {working && bulkHooks.kind === "reinstall" ? text.working : text.reinstallAllButton}
          </SettingsLinkButton>
        }
      >
        {result("reinstall")}
      </SettingsRow>
      {devBuild ? null : (
        <SettingsRow
          title={text.removeAll}
          description={text.removeAllHint}
          control={
            <SettingsInlineConfirm disabled={working} onConfirm={onRemoveAll}>
              {working && bulkHooks.kind === "remove" ? text.working : text.removeAllButton}
            </SettingsInlineConfirm>
          }
        >
          {result("remove")}
        </SettingsRow>
      )}
    </SettingsGroup>
  );
}
