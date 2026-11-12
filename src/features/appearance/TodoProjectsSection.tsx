import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { MAX_TODO_PROJECTS, readProject } from "../todos/project.ts";
import type { IslandSettings } from "./types";
import "../plugin-views/PluginIslandPagesSection.css";

type Projects = IslandSettings["todoProjects"];

export function TodoProjectsSection({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.todo;
  const projects = settings.todoProjects;
  const save = (todoProjects: Projects) => onSettingsChange({ ...settings, todoProjects });
  const taken = (name: string, id?: string) => projects.some((project) => project.name === name && project.id !== id);
  const move = (index: number, by: -1 | 1) => {
    const next = [...projects];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    save(next);
  };
  const rename = (input: HTMLInputElement, id: string, old: string) => {
    const name = readProject(input.value);
    if (!name || taken(name, id)) {
      input.value = old;
      return;
    }
    if (name !== old) save(projects.map((project) => (project.id === id ? { ...project, name } : project)));
  };
  const add = (input: HTMLInputElement) => {
    const name = readProject(input.value);
    if (!name || taken(name) || projects.length >= MAX_TODO_PROJECTS) return;
    save([...projects, { id: crypto.randomUUID(), name }]);
    input.value = "";
  };

  return (
    <SettingsGroup title={text.projects}>
      <SettingsRow title={text.projects} description={projects.length === 0 ? text.projectsEmpty : text.projectsHint} searchable={projects.length > 0}>
        <ul className="plugin-pages">
          {projects.map((project, index) => (
            <li className="plugin-pages__row" key={project.id}>
              <SettingsInput
                key={project.name}
                defaultValue={project.name}
                maxLength={20}
                aria-label={text.projectName(project.name)}
                onBlur={(event) => rename(event.currentTarget, project.id, project.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.currentTarget.value = project.name;
                    event.currentTarget.blur();
                  }
                }}
              />
              <button className="plugin-card__button" type="button" disabled={index === 0} aria-label={text.moveUp(project.name)} onClick={() => move(index, -1)}>
                <ArrowUp size={12} strokeWidth={2.4} />
              </button>
              <button className="plugin-card__button" type="button" disabled={index === projects.length - 1} aria-label={text.moveDown(project.name)} onClick={() => move(index, 1)}>
                <ArrowDown size={12} strokeWidth={2.4} />
              </button>
              <button className="plugin-card__button" type="button" aria-label={text.removeProject(project.name)} onClick={() => save(projects.filter((item) => item.id !== project.id))}>
                <Trash2 size={12} strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
        {projects.length < MAX_TODO_PROJECTS && (
          <SettingsInput
            placeholder={text.newProject}
            aria-label={text.newProject}
            maxLength={20}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              add(event.currentTarget);
            }}
          />
        )}
      </SettingsRow>
    </SettingsGroup>
  );
}
