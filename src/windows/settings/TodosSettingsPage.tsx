import { TodoProjectsSection } from "./sections/TodoProjectsSection";
import { TodoSettingsSection } from "./sections/TodoSettingsSection";
import type { IslandSettings } from "../../lib/settings/types";
import { SavePathSettingsSection } from "../../features/todos/SavePathSettingsSection";
import { useSharedSaveDirectorySetting, type SaveDirectorySetting } from "../../features/todos/saveDirectoryStore";
import { FeatureHeader } from "../../components/settings/FeatureHeader";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";
import { settingsCategoryIcon } from "../../features/plugin-kernel/settingsCategories";

type TodosSectionProps = {
  settings: IslandSettings;
  saveDirectory: SaveDirectorySetting;
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

export type TodosTab = "todos" | "todosStorage";

const sections = settingsSections<TodosSectionProps, TodosTab>();

sections.add({ id: "todos.general", category: "todos", order: 10, component: TodoSettingsSection });
sections.add({ id: "todosStorage.projects", category: "todosStorage", order: 20, component: ProjectsSection });
sections.add({ id: "todosStorage.save-path", category: "todosStorage", order: 30, component: SavePathSection });

export function TodosSettingsPage({ tab, ...page }: Omit<TodosSectionProps, "saveDirectory"> & { tab: TodosTab }) {
  const saveDirectory = useSharedSaveDirectorySetting();
  if (!saveDirectory) return null;
  const props = { ...page, saveDirectory };
  return (
    <>
      {tab === "todos" && <FeatureHeader feature="todos" icon={settingsCategoryIcon("todos")} />}
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
