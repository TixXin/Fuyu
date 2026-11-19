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
import { TodoReminderSettingsSection } from "./TodoReminderSettingsSection";
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

export type TodoSettingsTab = "todos" | "todosReminders" | "todosArchive";

const sections = settingsSections<TodosSectionProps, TodoSettingsTab>();

sections.add({ id: "todos.general", category: "todos", order: 10, component: TodoSettingsSection }, OWNER);
sections.add({ id: "todos.focus", category: "todos", order: 12, component: TodoFocusSettingsSection }, OWNER);
sections.add({ id: "todos.projects", category: "todos", order: 20, component: ProjectsSection }, OWNER);
sections.add({ id: "todosReminders.reminders", category: "todosReminders", order: 10, component: TodoReminderSettingsSection }, OWNER);
sections.add({ id: "todosArchive.rollover", category: "todosArchive", order: 10, component: TodoRolloverSettingsSection }, OWNER);
sections.add({ id: "todosArchive.save-path", category: "todosArchive", order: 30, component: SavePathSection }, OWNER);

export function TodosSettingsPage({ tab, ...page }: Omit<TodosSectionProps, "saveDirectory"> & { tab: TodoSettingsTab }) {
  const saveDirectory = useSharedSaveDirectorySetting();
  if (!saveDirectory) return null;
  const props = { ...page, saveDirectory };
  return (
    <>
      <FeatureHeader feature="todos" icon={settingsCategoryIcon("todos")} />
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
