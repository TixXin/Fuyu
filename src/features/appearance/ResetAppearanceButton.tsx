import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "../../i18n";
import "./ResetAppearanceButton.css";

const CONFIRM_TIMEOUT_MS = 4_000;

export function ResetAppearanceButton({ onReset, layout = false }: { onReset: () => void; layout?: boolean }) {
  const t = useTranslation();
  const text = t.settings.resetAppearance;
  const label = layout ? text.layoutLabel : text.label;
  const hint = layout ? text.layoutHint : text.hint;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) {
      return;
    }

    const timeout = window.setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        className="appearance-reset"
        type="button"
        onClick={() => setConfirming(true)}
      >
        <RotateCcw size={13} strokeWidth={2.4} aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="appearance-reset__confirm" role="group" aria-label={hint}>
      <button
        className="appearance-reset appearance-reset--danger"
        type="button"
        autoFocus
        onClick={() => {
          setConfirming(false);
          onReset();
        }}
      >
        <span>{t.settings.resetAppearance.confirm}</span>
      </button>
      <button className="appearance-reset" type="button" onClick={() => setConfirming(false)}>
        <span>{t.settings.resetAppearance.cancel}</span>
      </button>
    </div>
  );
}
