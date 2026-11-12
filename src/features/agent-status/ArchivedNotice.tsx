import { useState } from "react";
import { Archive } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "./api";
import "./ArchivedNotice.css";

export function ArchivedNotice({ removed, onUndo }: { removed: AgentSessionSummary | null; onUndo: () => void }) {
  const t = useTranslation();
  const [shown, setShown] = useState(removed);
  if (removed && removed !== shown) setShown(removed);
  if (!shown) return null;
  const leaving = !removed;

  return (
    <div
      className={`agent-archived${leaving ? " agent-archived--leaving" : ""}`}
      role="status"
      onAnimationEnd={(event) => {
        if (leaving && event.animationName === "agent-archived-out") setShown(null);
      }}
    >
      <Archive size={13} strokeWidth={2} aria-hidden="true" />
      <span>{t.agent.sessions.removed}</span>
      <button type="button" disabled={leaving} onClick={onUndo}>
        {t.agent.sessions.undo}
      </button>
    </div>
  );
}
