import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { CapsLockMode } from "../../i18n/sections/settings/capsLock";
import { isMacOS } from "../../lib/platform";
import { isBuiltinEnabled, setBuiltinConfig, switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig, useBuiltinPlugins } from "../plugin-kernel/useBuiltinPlugins";
import { CAPS_LOCK_MODES, readCapsLockConfig } from "./capsLockConfig.ts";
import { CapsLockIcon } from "./CapsLockIcon";
import { OWNER } from "./plugin/owner.ts";

function save(key: string, value: string | boolean) {
  void setBuiltinConfig(OWNER, key, value).catch((error: unknown) => console.error(`Could not save caps-lock.${key}`, error));
}

export function CapsLockSettings() {
  const text = useTranslation().settings.capsLock;
  const enabled = isBuiltinEnabled(useBuiltinPlugins(), OWNER, false);
  const config = readCapsLockConfig(useBuiltinConfig(OWNER));
  const options = CAPS_LOCK_MODES.map((value) => ({ value, label: text.modes[value] }));

  return (
    <>
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<CapsLockIcon on size={15} />}>{text.title}</SettingsIconTitle>}
        description={isMacOS ? text.hintMac : text.hint}
        checked={enabled}
        onChange={(on) => {
          void switchBuiltinPlugin(OWNER, on).catch((error: unknown) => console.error("Could not switch the caps-lock plugin", error));
        }}
      />
      {enabled && (
        <>
          <SettingsRow
            title={text.mode}
            indent
            control={<SettingsChoice<CapsLockMode> value={config.mode} options={options} ariaLabel={text.mode} onChange={(mode) => save("mode", mode)} />}
          />
          <SettingsToggleRow title={text.offAlert} description={text.offAlertHint} indent checked={config.offAlert} disabled={config.mode === "badge"} onChange={(on) => save("offAlert", on)} />
          <SettingsToggleRow title={text.badgeClick} description={text.badgeClickHint} indent checked={config.badgeClick} disabled={config.mode === "flash"} onChange={(on) => save("badgeClick", on)} />
        </>
      )}
    </>
  );
}
