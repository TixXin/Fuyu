import { TodoProjectsSection } from "../../features/appearance/TodoProjectsSection";
import { TodoSettingsSection } from "../../features/appearance/TodoSettingsSection";
import type { IslandSettings } from "../../features/appearance/types";
import { SavePathSettingsSection } from "../../features/todos/SavePathSettingsSection";
import type { useSaveDirectorySetting } from "../../features/todos/useSaveDirectorySetting";
import { FeatureHeader } from "./FeatureHeader";

type TodosSectionProps = {
  settings: IslandSettings;
  saveDirectory: ReturnType<typeof useSaveDirectorySetting>;
  onSettingsChange: (settings: IslandSettings) => void;
};

function ProjectsSection({ settings }: TodosSectionProps) {
  return <TodoProjectsSection projects={settings.todoProjects} />;
}

function SavePathSection({ saveDirectory }: TodosSectionProps) {
  return (
    <SavePathSettingsSection
      saveDirectoryDraft={saveDirectory.saveDirectoryDraft}
      savePathState={saveDirectory.savePathState}
      highlightSavePath={saveDirectory.highlightSavePath}
      onSaveDirectoryDraftChange={saveDirectory.onSaveDirectoryDraftChange}
      onSaveDirectory={saveDirectory.onSaveDirectory}
    />
  );
}

export function TodosSettingsPage(props: TodosSectionProps) {
  const { settings, onSettingsChange } = props;
  return (
    <>
      <FeatureHeader feature="todos" />
      <TodoSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <ProjectsSection {...props} />
      <SavePathSection {...props} />
    </>
  );
}
