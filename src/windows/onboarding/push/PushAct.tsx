import { useMemo, useState } from "react";
import { useTranslation } from "../../../i18n";
import { ActHeading } from "../ActHeading";
import { ConnectStep } from "./ConnectStep";
import { InstallStep } from "./InstallStep";
import { chosenProjects, planProjects, PUSH_STEPS, type PlannedProject } from "./plan";
import { PlatformStep } from "./PlatformStep";
import type { PushPlatform } from "./platforms";
import { ProjectsStep } from "./ProjectsStep";
import { TestStep } from "./TestStep";
import { usePushTargets } from "./usePushTargets";
import "./PushAct.css";

export function PushAct({ step, onSkip }: { step: number; onSkip: () => void }) {
  const text = useTranslation().onboarding.push;
  const targets = usePushTargets();
  const [edits, setEdits] = useState<PlannedProject[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [platform, setPlatform] = useState<PushPlatform>("feishu");
  const [connected, setConnected] = useState<ReadonlySet<string>>(new Set());
  const [scanning, setScanning] = useState<string | null>(null);
  const plan = useMemo(() => planProjects(targets.entries, edits), [targets.entries, edits]);
  const chosen = chosenProjects(plan, targets.entries, connected, scanning);

  const changeProject = (next: PlannedProject) => setEdits([...plan.filter((project) => project.key !== next.key), next]);
  const markConnected = (key: string) => {
    setConnected((previous) => new Set([...previous, key]));
    void targets.refresh();
  };

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <ol className="push-act__steps" aria-label={text.stepOf(step + 1, text.steps[step])}>
        {text.steps.map((name, at) => (
          <li key={name} className={at === step ? "push-act__step push-act__step--active" : at < step ? "push-act__step push-act__step--done" : "push-act__step"} aria-current={at === step ? "step" : undefined}>
            {name}
          </li>
        ))}
      </ol>
      {step === 0 && <InstallStep targets={targets} />}
      {step === 1 && <ProjectsStep entries={targets.entries} plan={plan} agreed={agreed} onAgree={() => setAgreed(true)} onChange={changeProject} />}
      {step === 2 && <PlatformStep platform={platform} onChange={setPlatform} />}
      {step === 3 && <ConnectStep entries={targets.entries} projects={agreed ? chosen : []} platform={platform} connected={connected} scanning={scanning} onScanning={setScanning} onConnected={markConnected} />}
      {step === 4 && <TestStep entries={targets.entries} projects={chosen.filter((project) => connected.has(project.key))} />}
      {step < PUSH_STEPS - 1 && (
        <button className="push-act__skip" type="button" onClick={onSkip}>
          {text.skipAct}
        </button>
      )}
    </>
  );
}
