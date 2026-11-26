import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import type { TaskbarLyricsContent, TaskbarLyricsIdle } from "../../../lib/settings/lyricsSettings";
import type { IslandSettings } from "../../../lib/settings/types";
import { useTaskbarAvailable } from "./useTaskbarAvailable";

type TaskbarLyricsSettingsProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

const CONTENTS: readonly TaskbarLyricsContent[] = ["both", "lyrics", "song"];
const IDLES: readonly TaskbarLyricsIdle[] = ["hide", "icon"];

export function TaskbarLyricsSettingsSection({ settings, onSettingsChange }: TaskbarLyricsSettingsProps) {
  const text = useTranslation().settings.musicBar.taskbar;
  const available = useTaskbarAvailable();
  if (!available && !settings.lyricsTaskbar) return null;

  return (
    <SettingsGroup title={text.title}>
      <SettingsToggleRow
        title={text.show}
        description={text.showHint}
        checked={settings.lyricsTaskbar}
        onChange={(lyricsTaskbar) => onSettingsChange({ ...settings, lyricsTaskbar })}
      />
      {settings.lyricsTaskbar && (
        <>
          <SettingsRow
            title={text.content}
            control={
              <SettingsChoice<TaskbarLyricsContent>
                value={settings.lyricsTaskbarContent}
                options={CONTENTS.map((value) => ({ value, label: text.contentOptions[value] }))}
                ariaLabel={text.content}
                onChange={(lyricsTaskbarContent) => onSettingsChange({ ...settings, lyricsTaskbarContent })}
              />
            }
          />
          <SettingsRow
            title={text.idle}
            control={
              <SettingsChoice<TaskbarLyricsIdle>
                value={settings.lyricsTaskbarIdle}
                options={IDLES.map((value) => ({ value, label: text.idleOptions[value] }))}
                ariaLabel={text.idle}
                onChange={(lyricsTaskbarIdle) => onSettingsChange({ ...settings, lyricsTaskbarIdle })}
              />
            }
          />
        </>
      )}
    </SettingsGroup>
  );
}
