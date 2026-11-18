import { FeatureHeader } from "../../components/settings/FeatureHeader";
import type { IslandSettings } from "../../lib/settings/types";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsCategoryIcon } from "../plugin-kernel/settingsCategories";
import { settingsSections } from "../plugin-kernel/settingsSlots";
import { OWNER } from "./plugin/owner.ts";
import { SavePathSettingsSection } from "./SavePathSettingsSection";
import { useSharedSaveDirectorySetting, type SaveDirectorySetting } from "./saveDirectoryStore";
import { TodoFocusSettingsSection } from "./TodoFocusSettingsSection";
import { TodoProjectsSection } from "./TodoProjectsSection";
import { TodoRolloverSettingsSection } from "./TodoRolloverSettingsSection";
import { TodoSettingsSection } from "./TodoSettingsSection";

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

const sections = settingsSections<TodosSectionProps, "todos">();

sections.add({ id: "todos.general", category: "todos", order: 10, component: TodoSettingsSection }, OWNER);
sections.add({ id: "todos.focus", category: "todos", order: 12, component: TodoFocusSettingsSection }, OWNER);
sections.add({ id: "todos.rollover", category: "todos", order: 15, component: TodoRolloverSettingsSection }, OWNER);
sections.add({ id: "todos.projects", category: "todos", order: 20, component: ProjectsSection }, OWNER);
sections.add({ id: "todos.save-path", category: "todos", order: 30, component: SavePathSection }, OWNER);

export function TodosSettingsPage(page: Omit<TodosSectionProps, "saveDirectory">) {
  const saveDirectory = useSharedSaveDirectorySetting();
  if (!saveDirectory) return null;
  const props = { ...page, saveDirectory };
  return (
    <>
      <FeatureHeader feature="todos" icon={settingsCategoryIcon("todos")} />
      <SlotView slot={sections} group="todos" props={props} />
    </>
  );
}
