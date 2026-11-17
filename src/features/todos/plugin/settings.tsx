import { useEffect, useLayoutEffect } from "react";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { settingsRunners } from "../../plugin-kernel/settingsSlots";
import { onSectionFocus } from "../../../lib/settings/sectionFocus";
import type { IslandSettings } from "../../../lib/settings/types";
import { TodosSettingsPage } from "../TodosSettingsPage";
import { useSaveDirectorySetting } from "../useSaveDirectorySetting";
import { announceSaveDirectorySetting, holdSaveDirectorySetting } from "../saveDirectoryStore";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

function SaveDirectoryRunner() {
  const saveDirectory = useSaveDirectorySetting();
  const { highlight } = saveDirectory;
  holdSaveDirectorySetting(saveDirectory);
  useLayoutEffect(() => {
    holdSaveDirectorySetting(saveDirectory);
    announceSaveDirectorySetting();
    return () => {
      holdSaveDirectorySetting(null);
      announceSaveDirectorySetting();
    };
  }, [saveDirectory]);
  useEffect(() => onSectionFocus((section) => {
    if (section === "savePath") highlight();
  }), [highlight]);
  return null;
}

addSettingsCategory("todos", ({ settings, onSettingsChange }: PageProps) => <TodosSettingsPage settings={settings} onSettingsChange={onSettingsChange} />, OWNER);
settingsRunners.add({ id: "todos.save-directory", component: SaveDirectoryRunner }, OWNER);
