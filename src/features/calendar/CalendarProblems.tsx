import { CalendarX2 } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import type { NativeError } from "../../i18n/nativeError";
import type { CalendarSnapshot } from "./api";
import { failedProblems } from "./syncStatus";

export function CalendarProblems({
  snapshot,
  failure,
  onRefresh,
  onOpenSettings,
}: {
  snapshot: CalendarSnapshot;
  failure: NativeError | string | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
}) {
  const text = useTranslation().calendar;
  const errorText = useErrorText();
  if (failure) {
    return (
      <div className="calendar-empty calendar-empty--failed" role="alert">
        <CalendarX2 className="calendar-empty__icon" size={18} strokeWidth={2} aria-hidden="true" />
        <strong>{text.loadFailed}</strong>
        <span className="calendar-empty__hint">{text.loadFailedHint}</span>
        <span className="calendar-empty__error">{errorText(failure)}</span>
        <div className="calendar-empty__actions">
          <button className="calendar-empty__primary" type="button" onClick={onRefresh}>
            {text.retry}
          </button>
          <button className="calendar-empty__secondary" type="button" onClick={onOpenSettings}>
            {text.openSettings}
          </button>
        </div>
      </div>
    );
  }
  const failed = failedProblems(snapshot);
  if (failed.length === 0) return null;
  return (
    <ul className="calendar-problems" role="status">
      {failed.map((problem) => (
        <li key={problem.sourceId} className="calendar-problems__item">
          <strong>{problem.name || text.unknownCalendar}</strong>
          <span>{errorText(problem.message)}</span>
        </li>
      ))}
    </ul>
  );
}
