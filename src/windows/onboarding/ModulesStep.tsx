import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../features/appearance/types";
import type { ClipboardHistorySettings } from "../../features/clipboard/api";
import { useTranslation } from "../../i18n";

/** The module switches kept in the island's settings, in the order the step lists them. */
const ISLAND_MODULES = [
  ["todo", "todoEnabled"],
  ["music", "musicEnabled"],
  ["agents", "agentStatusEnabled"],
  ["translation", "translationEnabled"],
  ["shelf", "shelfEnabled"],
  ["mail", "mailEnabled"],
  ["screenshot", "screenshotEnabled"],
] as const;

/** Step 2: the same module switches as the settings pages, with a line on what each does. */
export function ModulesStep({ settings, clipboard, onSettingsChange, onClipboardChange }: {
  settings: IslandSettings;
  clipboard: ClipboardHistorySettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onClipboardChange: (settings: ClipboardHistorySettings) => void;
}) {
  const text = useTranslation().onboarding.modules;
  const rows = [
    ...ISLAND_MODULES.map(([module, key]) => ({
      module,
      checked: settings[key],
      onChange: (enabled: boolean) => onSettingsChange({ ...settings, [key]: enabled }),
    })),
    { module: "clipboard" as const, checked: clipboard.enabled, onChange: (enabled: boolean) => onClipboardChange({ ...clipboard, enabled }) },
  ];
  // Two columns, so all eight fit the window without scrolling.
  const half = Math.ceil(rows.length / 2);

  return (
    <div className="onboarding-modules">
      {[rows.slice(0, half), rows.slice(half)].map((column, at) => (
        <SettingsGroup key={at}>
          {column.map(({ module, checked, onChange }) => (
            <SettingsToggleRow key={module} title={text[module][0]} description={text[module][1]} checked={checked} onChange={onChange} />
          ))}
        </SettingsGroup>
      ))}
    </div>
  );
}
