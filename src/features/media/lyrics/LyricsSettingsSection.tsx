import { useEffect, useState } from "react";
import { useTranslation } from "../../../i18n";
import { SettingsFolderRow } from "../../../components/settings/SettingsFolderRow";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { InflinkRow } from "./InflinkRow";
import { AppleMusicLyricsRows } from "./AppleMusicLyricsRows";
import type { LyricsIntro } from "./lyricsSettings";
import type { IslandSettings } from "../../../lib/settings/types";
import { useCollapsedText } from "../../../lib/settings/collapsedText";
import { isMacOS } from "../../../lib/platform";
import { islandLyricsNote } from "./islandLyricsNote.ts";
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
  const collapsed = useCollapsedText();
  const [folder, setFolder] = useState(settings.lyricsFolder);
  useEffect(() => setFolder(settings.lyricsFolder), [settings.lyricsFolder]);
  const saveFolder = () => {
    if (folder.trim() !== settings.lyricsFolder) onSettingsChange({ ...settings, lyricsFolder: folder.trim() });
  };

  if (part === "island") {
    const note = settings.lyricsOnIsland ? islandLyricsNote(settings, collapsed, isMacOS) : null;
    return (
      <SettingsGroup title={text.title}>
        <SettingsToggleRow
          title={text.onIsland}
          description={note === null ? text.onIslandHint : note === "noSource" ? text.onIslandNoSource : text.onIslandBlocked[note]}
          checked={settings.lyricsOnIsland}
          onChange={(lyricsOnIsland) => onSettingsChange({ ...settings, lyricsOnIsland })}
        />
        {settings.lyricsOnIsland && (
          <SettingsRow
            indent
            title={text.intro}
            description={text.introHint}
            control={
              <SettingsChoice<LyricsIntro>
                value={settings.lyricsIntro}
                ariaLabel={text.intro}
                options={[{ value: "todo", label: text.introTodo }, { value: "song", label: text.introSong }, { value: "note", label: text.introNote }]}
                onChange={(lyricsIntro) => onSettingsChange({ ...settings, lyricsIntro })}
              />
            }
          />
        )}
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      <SettingsFolderRow
        title={text.folder}
        description={text.folderHint}
        value={folder}
        placeholder={text.folderPlaceholder}
        ariaLabel={text.folder}
        revealPath={folder.trim() || null}
        browseTitle={text.folder}
        onChange={setFolder}
        onSubmit={saveFolder}
        onPick={(picked) => {
          setFolder(picked);
          onSettingsChange({ ...settings, lyricsFolder: picked });
        }}
      />
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
      {settings.lyricsOnline && (
        <AppleMusicLyricsRows enabled={settings.lyricsAppleMusic} onChange={(lyricsAppleMusic) => onSettingsChange({ ...settings, lyricsAppleMusic })} />
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
