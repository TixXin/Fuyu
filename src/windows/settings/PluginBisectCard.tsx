import { useState } from "react";
import { Check, Info } from "lucide-react";
import { useTranslation } from "../../i18n";
import { answerBisect, bisectOffList, startBisect, type BisectStep } from "./pluginBisect";

export function PluginBisectCard({ plugins, onBisect, onOpenPlugin }: {
  plugins: readonly { id: string; title: string }[];
  onBisect?: (off: readonly string[]) => Promise<unknown>;
  onOpenPlugin: (id: string) => void;
}) {
  const t = useTranslation().settings.pluginsV3;
  const text = t.page.diagnostics;
  const bisect = t.bisect;
  const [step, setStep] = useState<BisectStep>({ phase: "idle" });
  const [busy, setBusy] = useState(false);
  const titleOf = (id: string) => plugins.find((plugin) => plugin.id === id)?.title ?? id;

  const apply = (next: BisectStep) => {
    setStep(next);
    if (!onBisect) return;
    setBusy(true);
    void onBisect(bisectOffList(next)).finally(() => setBusy(false));
  };

  if (step.phase === "idle") {
    return (
      <div className="plugin-card plugin-card--pad" data-bisect-phase="idle">
        <p className="plugin-diag__intro">{plugins.length > 0 ? text.bisectIntro : text.bisectNone}</p>
        <button className="plugin-btn plugin-btn--sm" type="button" data-action="bisect-start" disabled={busy || !onBisect || plugins.length === 0} onClick={() => apply(startBisect(plugins.map((plugin) => plugin.id)))}>
          {text.bisectStart}
        </button>
      </div>
    );
  }

  return (
    <div className="plugin-card plugin-card--pad" data-bisect-phase={step.phase}>
      <div className={`plugin-callout${step.phase === "found" ? " plugin-callout--warn" : " plugin-callout--info"}`}>
        {step.phase === "testing" ? <Info size={15} strokeWidth={2.2} aria-hidden="true" /> : <Check size={15} strokeWidth={2.2} aria-hidden="true" />}
        <div>
          {step.phase === "testing" ? (
            <span>{bisect?.testing(step.step, step.testedOff.length, step.testedOff.map(titleOf).join("、"))}</span>
          ) : step.phase === "found" ? (
            <b>{bisect?.found(titleOf(step.culprit))}</b>
          ) : (
            <span>{bisect?.clear}</span>
          )}
          <div className="plugin-detail__buttons">
            {step.phase === "testing" ? (
              <>
                <button className="plugin-btn plugin-btn--sm" type="button" disabled={busy} onClick={() => apply(answerBisect(step, "fixed"))}>{bisect?.fixed}</button>
                <button className="plugin-btn plugin-btn--sm" type="button" disabled={busy} onClick={() => apply(answerBisect(step, "still-broken"))}>{bisect?.stillBroken}</button>
              </>
            ) : null}
            {step.phase === "found" ? (
              <button className="plugin-btn plugin-btn--sm" type="button" onClick={() => onOpenPlugin(step.culprit)}>{titleOf(step.culprit)}</button>
            ) : null}
            <button className="plugin-btn plugin-btn--sm plugin-btn--ghost" type="button" disabled={busy} onClick={() => apply({ phase: "idle" })}>{bisect?.restore}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
