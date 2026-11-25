import { useTranslation } from "../../i18n";
import type { TodoPrefs } from "./todoPrefs.ts";
import type { TodoItem } from "./types.ts";
import { useTodoDeadlineReminders } from "./useTodoDeadlineReminders";
import { useTodoTimedReminders } from "./useTodoTimedReminders";
import { useTodoWrapUpReminder } from "./useTodoWrapUpReminder";

export function useTodoDayReminders(prefs: TodoPrefs, date: string, todos: readonly TodoItem[]) {
  const text = useTranslation().todoIsland.reminders;
  useTodoTimedReminders({
    enabled: prefs.timedReminderEnabled,
    date,
    todos,
    leadMinutes: prefs.timedReminderLeadMinutes,
    aheadText: text.ahead,
  });
  useTodoWrapUpReminder({
    enabled: prefs.wrapUpReminderEnabled,
    time: prefs.wrapUpReminderTime,
    date,
    todos,
    title: text.wrapUp,
  });
  useTodoDeadlineReminders({
    mode: prefs.deadlineReminder,
    date,
    todos,
    titles: { today: text.deadlineToday, tomorrow: text.deadlineTomorrow },
  });
}
