import { useEffect, useState } from "react";
import { useTranslation } from "../../../i18n";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { InflinkRow } from "./InflinkRow";
import type { LyricsIslandPriority } from "./lyricsSettings";
import type { IslandSettings } from "../../appearance/types";
import "./LyricsSettingsSection.css";

export function LyricsSettingsSection({
  part,
  settings,
  onSettingsChange,
}: {
  part: "island" | "sources";
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.lyrics;
  const [folder, setFolder] = useState(settings.lyricsFolder);
  useEffect(() => setFolder(settings.lyricsFolder), [settings.lyricsFolder]);
  const saveFolder = () => {
    if (folder.trim() !== settings.lyricsFolder) onSettingsChange({ ...settings, lyricsFolder: folder.trim() });
  };

  if (part === "island") {
    return (
      <SettingsGroup title={text.title}>
        <SettingsToggleRow
          title={text.onIsland}
          description={settings.lyricsOnIsland && !settings.lyricsOnline && !settings.lyricsFolder ? text.onIslandNoSource : text.onIslandHint}
          checked={settings.lyricsOnIsland}
          onChange={(lyricsOnIsland) => onSettingsChange({ ...settings, lyricsOnIsland })}
        />
        {settings.lyricsOnIsland && (
          <SettingsRow
            indent
            title={text.priority}
            description={text.priorityHint}
            control={
              <SettingsChoice<LyricsIslandPriority>
                value={settings.lyricsIslandPriority}
                ariaLabel={text.priority}
                options={[{ value: "lyrics", label: text.priorityLyrics }, { value: "agent", label: text.priorityAgent }]}
                onChange={(lyricsIslandPriority) => onSettingsChange({ ...settings, lyricsIslandPriority })}
              />
            }
          />
        )}
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      <SettingsRow title={text.folder} description={text.folderHint}>
        <input
          className="lyrics-folder-input"
          value={folder}
          placeholder={text.folderPlaceholder}
          aria-label={text.folder}
          spellCheck={false}
          onChange={(event) => setFolder(event.currentTarget.value)}
          onBlur={saveFolder}
          onKeyDown={(event) => {
            if (event.key === "Enter") saveFolder();
          }}
        />
      </SettingsRow>
      <SettingsToggleRow
        title={text.online}
        description={text.onlineHint}
        checked={settings.lyricsOnline}
        onChange={(lyricsOnline) => onSettingsChange({ ...settings, lyricsOnline })}
      />
      {settings.lyricsOnline && (
        <SettingsToggleRow
          indent
          title={text.chinese}
          description={text.chineseHint}
          checked={settings.lyricsChinese}
          onChange={(lyricsChinese) => onSettingsChange({ ...settings, lyricsChinese })}
        />
      )}
      <InflinkRow />
      <SettingsSliderRow
        title={text.offset}
        description={text.offsetHint}
        value={settings.lyricsOffsetMs}
        min={-3000}
        max={3000}
        step={100}
        format={text.offsetValue}
        defaultValue={0}
        resetLabel={text.offsetReset}
        onChange={(lyricsOffsetMs) => onSettingsChange({ ...settings, lyricsOffsetMs })}
      />
    </SettingsGroup>
  );
}
