import { useState } from "react";
import { useErrorText, useTranslation } from "../../i18n";
import type { BuiltinPluginName } from "../../i18n/sections/settings/pluginsV3";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { BuiltinPlugin } from "../../features/plugin-kernel/api";
import { switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";

function BuiltinPluginRow({ plugin }: { plugin: BuiltinPlugin }) {
  const text = useTranslation().settings.pluginsV3;
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const essential = plugin.kind === "essential";
  const name = (text.builtinNames as Record<string, string | undefined>)[plugin.id as BuiltinPluginName] ?? plugin.id;
  const change = (enabled: boolean) => {
    setBusy(true);
    setError(null);
    void switchBuiltinPlugin(plugin.id, enabled)
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };
  const note = error ?? (essential ? text.essentialNote : text.builtinNotes[plugin.id as BuiltinPluginName] ?? null);
  return (
    <div className="plugins-v3__builtin" data-builtin={plugin.id} data-enabled={plugin.enabled}>
      <SettingsToggleRow
        searchable={false}
        title={name}
        description={note ? `${plugin.id} · ${note}` : plugin.id}
        checked={plugin.enabled}
        disabled={essential || busy}
        onChange={change}
      />
    </div>
  );
}

export function BuiltinPluginsGroup() {
  const text = useTranslation().settings.pluginsV3;
  const plugins = useBuiltinPlugins();
  return (
    <SettingsGroup title={text.builtins} footer={<SettingsFootnote text={text.builtinsNote} />}>
      {plugins === null ? <p className="plugins-v3__empty">{text.builtinsLoading}</p> : plugins.map((plugin) => <BuiltinPluginRow key={plugin.id} plugin={plugin} />)}
    </SettingsGroup>
  );
}
