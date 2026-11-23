import { Play, Timer, X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandNoticeMeta } from "../../plugin-kernel/slots";
import { dismissFinishedPomodoro, startPomodoro, useFinishedPomodoro } from "../pomodoro.ts";
import { POMODORO_NOTICE } from "./notice.ts";
import "../../../components/notice/IslandNotice.css";

const noticeSlot = defineSlot<object, IslandNoticeMeta<object>>("island.notice/v1");

function PomodoroNotice() {
  const t = useTranslation().islandWidgets.daily;
  const finished = useFinishedPomodoro();
  if (!finished) return null;
  return (
    <span className="screenshot-notice" role="alert">
      <Timer size={14} strokeWidth={2.2} aria-hidden="true" />
      <span className="screenshot-notice__text">{t.pomodoroDone(finished.minutes)}</span>
    </span>
  );
}

function PomodoroNoticeActions() {
  const t = useTranslation().islandWidgets.daily;
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  return (
    <span className="screenshot-notice__actions">
      <button className="screenshot-notice__action" type="button" aria-label={t.pomodoroAgain} title={t.pomodoroAgain} onClick={stop(() => startPomodoro(Date.now()))}>
        <Play size={12} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <button className="screenshot-notice__action" type="button" aria-label={t.dismiss} title={t.dismiss} onClick={stop(dismissFinishedPomodoro)}>
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}

noticeSlot.add({ id: POMODORO_NOTICE, order: 32, component: PomodoroNotice, actions: PomodoroNoticeActions });
