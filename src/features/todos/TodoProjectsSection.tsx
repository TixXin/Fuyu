import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { MAX_TODO_PROJECTS, readProject } from "./project.ts";
import { requestTodoProjectEdit } from "./projectEdits.ts";
import "./TodoProjectsSection.css";

export function TodoProjectsSection({ projects }: { projects: IslandSettings["todoProjects"] }) {
  const text = useTranslation().settings.todo;
  const newInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const taken = (name: string, id?: string) => projects.some((project) => project.name === name && project.id !== id);
  const rename = (input: HTMLInputElement, id: string, old: string) => {
    const name = readProject(input.value);
    if (!name || taken(name, id)) {
      input.value = old;
      return;
    }
    if (name !== old) requestTodoProjectEdit({ type: "rename", id, name });
  };
  const add = () => {
    const name = readProject(draft);
    if (!name || taken(name) || projects.length >= MAX_TODO_PROJECTS) return;
    requestTodoProjectEdit({ type: "add", name });
    setDraft("");
    newInputRef.current?.focus();
  };
  const canAdd = Boolean(readProject(draft)) && !taken(readProject(draft) ?? "") && projects.length < MAX_TODO_PROJECTS;

  return (
    <SettingsGroup title={text.projects} footer={projects.length > 0 ? <SettingsFootnote text={text.projectsHint} /> : undefined}>
      <SettingsRow title={text.projects} description={projects.length === 0 ? text.projectsEmpty : undefined} searchable={projects.length > 0}>
        {projects.length > 0 && (
          <ul className="todo-projects">
            {projects.map((project, index) => (
              <li className="todo-projects__row" key={project.id}>
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
                <button className="todo-projects__button" type="button" disabled={index === 0} aria-label={text.moveUp(project.name)} onClick={() => requestTodoProjectEdit({ type: "move", id: project.id, by: -1 })}>
                  <ArrowUp size={12} strokeWidth={2.4} />
                </button>
                <button className="todo-projects__button" type="button" disabled={index === projects.length - 1} aria-label={text.moveDown(project.name)} onClick={() => requestTodoProjectEdit({ type: "move", id: project.id, by: 1 })}>
                  <ArrowDown size={12} strokeWidth={2.4} />
                </button>
                <button className="todo-projects__button" type="button" aria-label={text.removeProject(project.name)} onClick={() => requestTodoProjectEdit({ type: "remove", id: project.id })}>
                  <Trash2 size={12} strokeWidth={2.4} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {projects.length < MAX_TODO_PROJECTS && (
          <div className="todo-projects__add">
            <SettingsInput
              ref={newInputRef}
              value={draft}
              placeholder={text.newProject}
              aria-label={text.newProject}
              maxLength={20}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                add();
              }}
            />
            <button className="todo-projects__button todo-projects__button--add" type="button" disabled={!canAdd} onClick={add}>
              <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
              {text.addProject}
            </button>
          </div>
        )}
      </SettingsRow>
    </SettingsGroup>
  );
}
