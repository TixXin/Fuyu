import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { useTranslation } from "../../../i18n";
import { NOTCH_TEXT_KINDS, NOTCH_TEXT_MODES, saveNotchText, useNotchTextModes } from "../../../lib/settings/collapsedText";

export function NotchTextRows({ lyricsOff, disabled }: { lyricsOff: boolean; disabled: boolean }) {
  const text = useTranslation().settings.layout;
  const modes = useNotchTextModes();
  const options = NOTCH_TEXT_MODES.map((mode) => ({ value: mode, label: text.notchTextModes[mode] }));
  return (
    <SettingsGroup title={text.notchTextTitle} footer={text.notchTextHint}>
      {NOTCH_TEXT_KINDS.map((kind) => (
        <SettingsRow
          key={kind}
          title={text.notchTextKinds[kind]}
          description={kind === "lyrics" && lyricsOff ? text.lyricsNeedIsland : undefined}
          control={(
            <span data-notch-text={kind}>
              <SettingsSelect
                value={modes[kind]}
                options={options}
                ariaLabel={`${text.notchTextTitle} · ${text.notchTextKinds[kind]}`}
                disabled={disabled}
                onChange={(mode) => saveNotchText({ ...modes, [kind]: mode })}
              />
            </span>
          )}
        />
      ))}
    </SettingsGroup>
  );
}
