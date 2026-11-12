import { useTranslation } from "../../../i18n";
import "./TodoProjects.css";

export function TodoProjectFilter({ projects, value, onChange }: { projects: readonly string[]; value: string | null; onChange: (project: string | null) => void }) {
  const text = useTranslation().todoIsland;
  const chip = (project: string | null, label: string) => (
    <button key={project ?? ""} className="todo-project-filter__chip" type="button" aria-pressed={value === project} onClick={() => onChange(project)}>
      {label}
    </button>
  );
  return (
    <div className="todo-project-filter" role="group" aria-label={text.projectFilter}>
      {chip(null, text.allProjects)}
      {projects.map((project) => chip(project, project))}
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
