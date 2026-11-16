import { TodoProjectsSection } from "./sections/TodoProjectsSection";
import { TodoSettingsSection } from "./sections/TodoSettingsSection";
import type { IslandSettings } from "../../lib/settings/types";
import { SavePathSettingsSection } from "../../features/todos/SavePathSettingsSection";
import type { useSaveDirectorySetting } from "../../features/todos/useSaveDirectorySetting";
import { FeatureHeader } from "./FeatureHeader";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

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

const sections = settingsSections<TodosSectionProps, "todos">();

sections.add({ id: "todos.general", category: "todos", order: 10, component: TodoSettingsSection });
sections.add({ id: "todos.projects", category: "todos", order: 20, component: ProjectsSection });
sections.add({ id: "todos.save-path", category: "todos", order: 30, component: SavePathSection });

export function TodosSettingsPage(props: TodosSectionProps) {
  return (
    <>
      <FeatureHeader feature="todos" />
      <SlotView slot={sections} group="todos" props={props} />
    </>
  );
}
