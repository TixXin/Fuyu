import { useEffect, useLayoutEffect } from "react";
import { FeaturePageLink } from "../../../components/settings/FeaturePageLink";
import { useTranslation } from "../../../i18n";
import { onSectionFocus } from "../../../lib/settings/sectionFocus";
import type { IslandSettings } from "../../../lib/settings/types";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { useShortcutOwners } from "../../../lib/shortcut/useShortcutOwners";
import { isBuiltinEnabled, switchBuiltinPlugin } from "../../plugin-kernel/builtinSwitches";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { settingsRunners, settingsSections, shortcutSections, type SettingsRunnerProps, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { useBuiltinPlugins } from "../../plugin-kernel/useBuiltinPlugins";
import { announceSaveDirectorySetting, holdSaveDirectorySetting } from "../saveDirectoryStore";
import { TodoShortcutSection } from "../TodoShortcutSection";
import { TodosSettingsPage } from "../TodosSettingsPage";
import { useSaveDirectorySetting } from "../useSaveDirectorySetting";
import { useTodoQuickAddShortcut } from "../useTodoShortcut";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

type TodosSectionProps = {
  settings: IslandSettings;
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

function TodoShortcutOwners({ settings }: SettingsRunnerProps) {
  const t = useTranslation();
  const plugins = useBuiltinPlugins();
  const [shortcut] = useTodoQuickAddShortcut();
  const enabled = isBuiltinEnabled(plugins, OWNER, settings.todoEnabled);
  useReportShortcutOwners(
    "todos",
    42,
    enabled && shortcut ? [{ id: "todoQuickAdd", label: t.settings.shortcuts.todoQuickAdd, shortcut, home: "todos" }] : [],
  );
  return null;
}

function TodosPageShortcutSection({ settings }: TodosSectionProps) {
  const { takenBy } = useShortcutOwners(settings);
  return <TodoShortcutSection takenBy={(next) => takenBy(next, "todoQuickAdd")} />;
}

function TodosShortcutsPageSection({ settings, onSettingsChange, onOpenPage, takenBy }: ShortcutsSectionProps) {
  const t = useTranslation();
  const plugins = useBuiltinPlugins();
  const enabled = isBuiltinEnabled(plugins, OWNER, settings.todoEnabled);
  return (
    <TodoShortcutSection
      title={t.settings.categories.todos}
      action={<FeaturePageLink page="todos" onOpenPage={onOpenPage} />}
      enabled={enabled}
      takenBy={(next) => takenBy(next, "todoQuickAdd")}
      onTurnOn={() => {
        onSettingsChange({ ...settings, todoEnabled: true });
        void switchBuiltinPlugin(OWNER, true);
      }}
    />
  );
}

const todosSections = settingsSections<TodosSectionProps, "todos">();

addSettingsCategory("todos", ({ settings, onSettingsChange }: PageProps) => <TodosSettingsPage settings={settings} onSettingsChange={onSettingsChange} />, OWNER);
todosSections.add({ id: "todos.shortcuts", category: "todos", order: 15, component: TodosPageShortcutSection }, OWNER);
shortcutSections.add({ id: "shortcuts.todos", category: "shortcuts", order: 42, component: TodosShortcutsPageSection }, OWNER);
settingsRunners.add({ id: "todos.save-directory", component: SaveDirectoryRunner }, OWNER);
settingsRunners.add({ id: "todos.shortcut-owners", component: TodoShortcutOwners }, OWNER);
