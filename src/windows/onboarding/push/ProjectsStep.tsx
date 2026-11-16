import { CC_CONNECT_AGENT_LABELS } from "../../../lib/cc-connect/labels";
import { useTranslation } from "../../../i18n";
import { nameProblem, readyTargets, type PlannedProject, type TargetEntry } from "./plan";

export function ProjectsStep({ entries, plan, agreed, onAgree, onChange }: {
  entries: readonly TargetEntry[];
  plan: readonly PlannedProject[];
  agreed: boolean;
  onAgree: () => void;
  onChange: (project: PlannedProject) => void;
}) {
  const text = useTranslation().onboarding.push;
  if (readyTargets(entries).length === 0) return <p className="push-act__lead">{text.projects.none}</p>;
  if (!agreed) {
    return (
      <div className="push-act__ask">
        <p className="push-act__lead">{text.projects.ask}</p>
        <button className="onboarding__button onboarding__button--primary" type="button" onClick={onAgree}>
          {text.projects.agree}
        </button>
      </div>
    );
  }
  return (
    <>
      <p className="push-act__lead">{text.projects.lead}</p>
      <ul className="push-act__list">
        {plan.map((project) => {
          const entry = entries.find((found) => found.target.id === project.targetId);
          const computer = entry?.target.label ?? text.thisComputer;
          const agent = CC_CONNECT_AGENT_LABELS[project.agent] ?? project.agent;
          const problem = project.on ? nameProblem(project, plan, entry?.state?.taken ?? []) : null;
          return (
            <li key={project.key} className="push-act__row push-act__row--project">
              <input
                type="checkbox"
                className="push-act__check"
                checked={project.on}
                aria-label={`${computer} · ${agent}`}
                onChange={(event) => onChange({ ...project, on: event.currentTarget.checked })}
              />
              <div className="push-act__main">
                <span className="push-act__note">{`${computer} · ${agent}`}</span>
                <input
                  className="push-act__input"
                  value={project.name}
                  disabled={!project.on}
                  aria-label={text.projects.nameLabel(computer, agent)}
                  aria-invalid={problem !== null}
                  onChange={(event) => onChange({ ...project, name: event.currentTarget.value.trim() })}
                />
                {problem ? <span className="push-act__error">{text.projects.problems[problem]}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
