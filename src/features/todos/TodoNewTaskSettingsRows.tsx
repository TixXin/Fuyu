import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useTranslation } from "../../i18n";
import { TODO_DEFAULT_PRIORITIES, type TodoDefaultPriority } from "./todoPrefs.ts";
import type { TodoProject } from "./types.ts";
import { useTodoPrefs } from "./useTodoPrefs";

export function TodoNewTaskSettingsRows({ projects }: { projects: readonly TodoProject[] }) {
  const text = useTranslation().settings.todo;
  const [prefs, setPrefs] = useTodoPrefs();

  const projectOptions: readonly { value: string; label: string }[] = [
    { value: "", label: text.defaultProjectInbox },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];
  const chosenProject = projects.some((project) => project.id === prefs.defaultProject) ? prefs.defaultProject : "";

  const priorityOptions: readonly { value: TodoDefaultPriority; label: string }[] = TODO_DEFAULT_PRIORITIES.map((priority) => ({
    value: priority,
    label: text.defaultPriorityOptions[priority],
  }));

  return (
    <>
      <SettingsRow
        title={text.defaultProject}
        description={text.defaultProjectHint}
        control={
          <SettingsSelect
            value={chosenProject}
            options={projectOptions}
            ariaLabel={text.defaultProject}
            onChange={(defaultProject) => setPrefs((current) => ({ ...current, defaultProject }))}
          />
        }
      />
      <SettingsRow
        title={text.defaultPriority}
        description={text.defaultPriorityHint}
        control={
          <SettingsChoice
            value={prefs.defaultPriority}
            options={priorityOptions}
            ariaLabel={text.defaultPriority}
            onChange={(defaultPriority) => setPrefs((current) => ({ ...current, defaultPriority }))}
          />
        }
      />
    </>
  );
}
