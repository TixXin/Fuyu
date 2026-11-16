import type { ComponentProps, ComponentType } from "react";
import { addSettingsCategory, type SettingsPageProps } from "../../../windows/settings/slots/categorySlot";
import { MusicSettingsPage } from "../MusicSettingsPage";

const music = (tab: ComponentProps<typeof MusicSettingsPage>["tab"]): ComponentType<SettingsPageProps> =>
  function MusicPage({ settings, onSettingsChange }) {
    return <MusicSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} />;
  };

addSettingsCategory("music", music("music"));
addSettingsCategory("musicLyrics", music("musicLyrics"));
addSettingsCategory("musicLyricsStyle", music("musicLyricsStyle"));
