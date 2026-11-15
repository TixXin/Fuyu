import { Check, Circle, Send } from "lucide-react";
import { useState } from "react";
import { useErrorText, useTranslation } from "../../../i18n";
import type { PlannedProject, TargetEntry } from "./plan";

type SendState = { key: string; phase: "sending" | "sent" | "failed"; error?: string };

export function TestStep({ entries, projects }: { entries: readonly TargetEntry[]; projects: readonly PlannedProject[] }) {
  const text = useTranslation().onboarding.push.test;
  const errorText = useErrorText();
  const [sending, setSending] = useState<SendState | null>(null);
  if (projects.length === 0) return <p className="push-act__lead">{text.none}</p>;

  const send = async (project: PlannedProject, entry: TargetEntry, chatKey: string) => {
    setSending({ key: project.key, phase: "sending" });
    try {
      await entry.target.send(project.name, chatKey, text.message);
      setSending({ key: project.key, phase: "sent" });
    } catch (reason) {
      setSending({ key: project.key, phase: "failed", error: errorText(reason) });
    }
  };

  return (
    <>
      <p className="push-act__lead">{text.lead}</p>
      <ul className="push-act__list">
        {projects.map((project) => {
          const entry = entries.find((found) => found.target.id === project.targetId);
          if (!entry) return null;
          const chat = entry.state?.projects.find((found) => found.name === project.name)?.chats[0] ?? null;
          const running = entry.state?.running ?? false;
          const mine = sending?.key === project.key ? sending : null;
          return (
            <li key={project.key} className="push-act__row" data-project={project.name}>
              {chat ? <Check size={15} aria-hidden="true" className="push-act__ok" /> : <Circle size={15} aria-hidden="true" className="push-act__icon" />}
              <div className="push-act__main">
                <span className="push-act__name">{project.name}</span>
                <span className="push-act__note">{chat ? text.received : running ? text.waiting : text.notRunning}</span>
                {mine?.phase === "sent" ? <span className="push-act__note">{text.sent}</span> : null}
                {mine?.error ? <span className="push-act__error">{mine.error}</span> : null}
              </div>
              {chat ? (
                <button className="onboarding__button" type="button" disabled={sending?.phase === "sending"} onClick={() => void send(project, entry, chat.key)}>
                  <Send size={13} aria-hidden="true" />
                  {mine?.phase === "sending" ? text.sending : text.send}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
