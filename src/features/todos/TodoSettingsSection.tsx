import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { TodoNewTaskSettingsRows } from "./TodoNewTaskSettingsRows";
import type { TodoInsertPosition, TodoSortBy } from "./todoPrefs.ts";
import { useTodoPrefs } from "./useTodoPrefs";

export function TodoSettingsSection({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.todo;
  const [prefs, setPrefs] = useTodoPrefs();

  const sortOptions: readonly { value: TodoSortBy; label: string }[] = [
    { value: "manual", label: text.sortOptions.manual },
    { value: "priority", label: text.sortOptions.priority },
    { value: "createdDesc", label: text.sortOptions.createdDesc },
  ];

  const insertOptions: readonly { value: TodoInsertPosition; label: string }[] = [
    { value: "bottom", label: text.insertOptions.bottom },
    { value: "top", label: text.insertOptions.top },
  ];

  return (
    <>
      <SettingsGroup title={text.displayGroup}>
        <SettingsToggleRow
          title={t.settings.layout.showIdleTodoCount}
          checked={settings.showIdleTodoCount}
          onChange={(showIdleTodoCount) => onSettingsChange({ ...settings, showIdleTodoCount })}
        />
        <SettingsToggleRow
          title={text.showElapsed}
          description={text.showElapsedHint}
          checked={prefs.showElapsed}
          onChange={(showElapsed) => setPrefs((current) => ({ ...current, showElapsed }))}
        />
        <SettingsToggleRow
          title={text.rotateTodos}
          checked={settings.rotateTodos}
          onChange={(rotateTodos) => onSettingsChange({ ...settings, rotateTodos })}
        />
        {settings.rotateTodos && (
          <SettingsNumberRow
            title={text.rotationSeconds}
            indent
            value={settings.todoRotationSeconds}
            min={1}
            max={3_600}
            onChange={(todoRotationSeconds) => onSettingsChange({ ...settings, todoRotationSeconds })}
          />
        )}
        <SettingsRow
          title={text.sortBy}
          control={
            <SettingsSelect
              value={prefs.sortBy}
              options={sortOptions}
              ariaLabel={text.sortBy}
              onChange={(sortBy) => setPrefs((current) => ({ ...current, sortBy }))}
            />
          }
        />
        <SettingsToggleRow
          title={text.enableReorder}
          checked={settings.enableTodoReorder}
          disabled={prefs.sortBy === "createdDesc"}
          onChange={(enableTodoReorder) => onSettingsChange({ ...settings, enableTodoReorder })}
        />
      </SettingsGroup>

      <SettingsGroup title={text.inputGroup}>
        <SettingsToggleRow
          title={text.inlineSyntax}
          description={text.inlineSyntaxHint}
          checked={prefs.inlineSyntax}
          onChange={(inlineSyntax) => setPrefs((current) => ({ ...current, inlineSyntax }))}
        />
        <SettingsRow
          title={text.insertPosition}
          control={
            <SettingsChoice
              value={prefs.insertPosition}
              options={insertOptions}
              ariaLabel={text.insertPosition}
              onChange={(insertPosition) => setPrefs((current) => ({ ...current, insertPosition }))}
            />
          }
        />
        <TodoNewTaskSettingsRows projects={settings.todoProjects} />
      </SettingsGroup>
    </>
  );
}
