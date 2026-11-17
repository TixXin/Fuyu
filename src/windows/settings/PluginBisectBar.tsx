import { useState } from "react";
import { useTranslation } from "../../i18n";
import { answerBisect, bisectOffList, startBisect, type BisectStep } from "./pluginBisect";

export function PluginBisectBar({
  thirdPartyIds,
  onBisect,
}: {
  thirdPartyIds: readonly string[];
  onBisect?: (off: readonly string[]) => Promise<unknown>;
}) {
  const bisectText = useTranslation().settings.pluginsV3.bisect;
  const [step, setStep] = useState<BisectStep>({ phase: "idle" });
  const [busy, setBusy] = useState(false);

  if (!bisectText || !onBisect || (thirdPartyIds.length === 0 && step.phase === "idle")) return null;

  const applyStep = (next: BisectStep) => {
    setStep(next);
    if (!onBisect) return;
    setBusy(true);
    void onBisect(bisectOffList(next)).finally(() => setBusy(false));
  };

  if (step.phase === "idle") {
    return (
      <div className="plugins-v3__bisect-bar" data-bisect-phase="idle">
        <button
          className="plugins-v3__diag-link"
          type="button"
          disabled={busy}
          onClick={() => applyStep(startBisect(thirdPartyIds))}
        >
          {bisectText.start}
        </button>
      </div>
    );
  }

  return (
    <div className="plugins-v3__safe plugins-v3__bisect" data-bisect-phase={step.phase}>
      <div className="plugins-v3__safe-text">
        {step.phase === "testing" ? (
          <span>{bisectText.testing(step.step, step.testedOff.length, step.testedOff.join(", "))}</span>
        ) : step.phase === "found" ? (
          <strong>{bisectText.found(step.culprit)}</strong>
        ) : (
          <span>{bisectText.clear}</span>
        )}
      </div>
      <div className="plugins-v3__bisect-actions">
        {step.phase === "testing" ? (
          <>
            <button
              className="plugins-v3__leave"
              type="button"
              disabled={busy}
              onClick={() => applyStep(answerBisect(step, "fixed"))}
            >
              {bisectText.fixed}
            </button>
            <button
              className="plugins-v3__leave"
              type="button"
              disabled={busy}
              onClick={() => applyStep(answerBisect(step, "still-broken"))}
            >
              {bisectText.stillBroken}
            </button>
          </>
        ) : null}
        <button
          className="plugins-v3__leave"
          type="button"
          disabled={busy}
          onClick={() => applyStep({ phase: "idle" })}
        >
          {bisectText.restore}
        </button>
      </div>
    </div>
  );
}
