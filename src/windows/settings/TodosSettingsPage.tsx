import { TodoProjectsSection } from "../../features/appearance/TodoProjectsSection";
import { TodoSettingsSection } from "../../features/appearance/TodoSettingsSection";
import type { IslandSettings } from "../../features/appearance/types";
import { SavePathSettingsSection } from "../../features/todos/SavePathSettingsSection";
import type { useSaveDirectorySetting } from "../../features/todos/useSaveDirectorySetting";
import { FeatureHeader } from "./FeatureHeader";

export function TodosSettingsPage({
  settings,
  saveDirectory,
  onSettingsChange,
}: {
  settings: IslandSettings;
  saveDirectory: ReturnType<typeof useSaveDirectorySetting>;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  return (
    <>
      <FeatureHeader
        feature="todos"
        checked={settings.todoEnabled}
        onChange={(todoEnabled) => onSettingsChange({ ...settings, todoEnabled })}
      />
      {settings.todoEnabled && <>
      <TodoSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <TodoProjectsSection projects={settings.todoProjects} />
      <SavePathSettingsSection
        saveDirectoryDraft={saveDirectory.saveDirectoryDraft}
        savePathState={saveDirectory.savePathState}
        highlightSavePath={saveDirectory.highlightSavePath}
        onSaveDirectoryDraftChange={saveDirectory.onSaveDirectoryDraftChange}
        onSaveDirectory={saveDirectory.onSaveDirectory}
      />
      </>}
    </>
  );
}
