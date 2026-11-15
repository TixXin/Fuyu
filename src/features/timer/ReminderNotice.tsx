import { AlarmClockPlus, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { REMINDER_ICONS } from "./reminderIcons";
import { dismissIslandReminder, snoozeIslandReminder } from "./reminders";
import type { ShownReminder } from "./useIslandReminder";
import "../screenshot/ScreenshotNotice.css";

export function ReminderNotice({ reminder }: { reminder: ShownReminder }) {
  const t = useTranslation().timer.breaks;
  const { current, more } = reminder;
  const Icon = REMINDER_ICONS[current.icon];
  const text = [current.title, current.detail, more > 0 ? t.more(more) : null].filter(Boolean).join(" · ");
  return (
    <span className="screenshot-notice reminder-notice" role="alert" title={text}>
      <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
      <span className="screenshot-notice__text">{text}</span>
    </span>
  );
}

export function ReminderNoticeActions({ reminder }: { reminder: ShownReminder }) {
  const t = useTranslation().timer.breaks;
  const { id, snoozable } = reminder.current;
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  return (
    <span className="screenshot-notice__actions">
      {snoozable !== false ? (
        <button className="screenshot-notice__action" type="button" aria-label={t.snooze} title={t.snooze} onClick={stop(() => snoozeIslandReminder(id))}>
          <AlarmClockPlus size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
      <button className="screenshot-notice__action" type="button" aria-label={t.skip} title={t.skip} onClick={stop(() => dismissIslandReminder(id))}>
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
