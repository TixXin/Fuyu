import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "../../../i18n";
import "./TodoProjects.css";

export const INBOX = "";

export function TodoProjectFilter({ projects, value, onChange, onCreate }: {
  projects: readonly string[];
  value: string | null;
  onChange: (project: string | null) => void;
  onCreate?: (name: string) => void;
}) {
  const text = useTranslation().todoIsland;
  const [naming, setNaming] = useState(false);
  const chip = (project: string | null, label: string) => (
    <button key={`p:${project ?? "*"}`} className="todo-project-filter__chip" type="button" aria-pressed={value === project} onClick={() => onChange(project)}>
      {label}
    </button>
  );
  return (
    <div className="todo-project-filter" role="group" aria-label={text.projectFilter}>
      {chip(null, text.allProjects)}
      {onCreate && chip(INBOX, text.noProject)}
      {projects.map((project) => chip(project, project))}
      {onCreate && (naming ? (
        <input
          className="todo-project-filter__chip todo-project-filter__name"
          autoFocus
          maxLength={20}
          placeholder={text.newProjectPlaceholder}
          aria-label={text.newProject}
          onBlur={() => setNaming(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setNaming(false);
            }
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            const name = event.currentTarget.value.trim();
            setNaming(false);
            if (name) {
              onCreate(name);
              onChange(name);
            }
          }}
        />
      ) : (
        <button className="todo-project-filter__chip todo-project-filter__add" type="button" aria-label={text.newProject} title={text.newProject} onClick={() => setNaming(true)}>
          <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function TodoProjectHeading({ project, open }: { project: string | null; open: number }) {
  const text = useTranslation().todoIsland;
  const name = project ?? text.noProject;
  return (
    <div className="todo-project-heading" role="listitem" aria-label={text.projectCount(name, open)}>
      <span className="todo-project-heading__name">{name}</span>
      {open > 0 && <span className="todo-project-heading__count" aria-hidden="true">{open}</span>}
    </div>
  );
}
