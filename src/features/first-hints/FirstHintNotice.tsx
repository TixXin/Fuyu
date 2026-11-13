import { Check, Lightbulb, Plug } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { FirstHintsController } from "./useFirstHints";
import "./FirstHintNotice.css";

export function FirstHintNotice({ hints }: { hints: FirstHintsController }) {
  const t = useTranslation().island.firstHint;
  if (!hints.current) return null;
  return (
    <span className="first-hint" role="status" onPointerEnter={hints.hold} onPointerLeave={hints.release}>
      <Lightbulb className="first-hint__icon" size={14} strokeWidth={2} aria-hidden="true" />
      <span className="first-hint__text">{t[hints.current]}</span>
    </span>
  );
}

export function FirstHintActions({ hints, onConnectTools }: { hints: FirstHintsController; onConnectTools: () => void }) {
  const t = useTranslation().island.firstHint;
  if (!hints.current) return null;
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  return (
    <span className="first-hint__actions" onPointerEnter={hints.hold} onPointerLeave={hints.release}>
      {hints.current === "agent" && (
        <button
          className="first-hint__action"
          type="button"
          aria-label={t.connectTools}
          title={t.connectTools}
          onClick={stop(() => {
            hints.dismiss();
            onConnectTools();
          })}
        >
          <Plug size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      <button className="first-hint__action" type="button" aria-label={t.gotIt} title={t.gotIt} onClick={stop(hints.dismiss)}>
        <Check size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
