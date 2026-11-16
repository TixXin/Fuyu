import type { ComponentProps, ComponentType } from "react";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { MusicSettingsPage } from "../MusicSettingsPage";
import type { IslandSettings } from "../../../lib/settings/types";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

const music = (tab: ComponentProps<typeof MusicSettingsPage>["tab"]): ComponentType<PageProps> =>
  function MusicPage({ settings, onSettingsChange }) {
    return <MusicSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} />;
  };

addSettingsCategory("music", music("music"), OWNER);
addSettingsCategory("musicLyrics", music("musicLyrics"), OWNER);
addSettingsCategory("musicLyricsStyle", music("musicLyricsStyle"), OWNER);
