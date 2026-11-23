import { useState } from "react";
import { Check, Pencil, Plus, Repeat, X } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { clickOnly } from "../../components/island-widget/clickOnly";
import { useLocale, useTranslation } from "../../i18n";
import { HABIT_NAME_MAX, MAX_HABITS } from "./dailyFormat.ts";
import { removeHabit, setHabitNames } from "./customize.ts";
import { dayKey, weekDays } from "./days.ts";
import { editorKeys, stopPointer } from "./inputGuards.ts";
import { toggleHabit, useDaily, useNow } from "./store.ts";

export function HabitsWidget() {
  const t = useTranslation().islandWidgets.daily;
  const { locale } = useLocale();
  const data = useDaily();
  const now = useNow(60_000);
  const [editing, setEditing] = useState(false);
  const [focusAt, setFocusAt] = useState<number | null>(null);
  const today = dayKey(now);
  const names = data.habitNames ?? t.habitNames;
  const shown = names.map((name, at) => name.trim() || t.habitFallback(at + 1));
  const week = weekDays(now).map((date) => ({ key: dayKey(date), name: date.toLocaleDateString(locale, { weekday: "short" }) }));
  const rename = (at: number, name: string) => setHabitNames(names.map((current, index) => (index === at ? name : current)));
  const add = () => {
    setHabitNames([...names, ""]);
    setFocusAt(names.length);
  };
  const finish = () => {
    setEditing(false);
    setFocusAt(null);
  };
  const aside = editing ? (
    <span className="daily-aside-buttons">
      {names.length < MAX_HABITS ? (
        <button className="daily-icon-button" type="button" aria-label={t.addHabit} title={t.addHabit} onClick={clickOnly(add)}>
          <Plus size={12} strokeWidth={2.4} />
        </button>
      ) : null}
      <button className="daily-icon-button" type="button" aria-label={t.done} title={t.done} onClick={clickOnly(finish)}>
        <Check size={12} strokeWidth={2.6} />
      </button>
    </span>
  ) : (
    <span className="daily-aside-buttons">
      <span>{t.thisWeek}</span>
      <button className="daily-icon-button daily-icon-button--hover" type="button" aria-label={t.edit} title={t.edit} onClick={clickOnly(() => setEditing(true))}>
        <Pencil size={11} strokeWidth={2.2} />
      </button>
    </span>
  );
  return (
    <WidgetFrame icon={Repeat} title={t.names.habits} aside={aside} className="daily-habits">
      <div className="daily-habits__rows" data-editing={editing || undefined}>
        {names.map((name, at) => (
          <div key={at} className="daily-habits__row" data-habit={at}>
            {editing ? (
              <>
                <input
                  className="daily-input daily-habits__input"
                  value={name}
                  maxLength={HABIT_NAME_MAX}
                  placeholder={t.habitPlaceholder}
                  aria-label={t.habitPlaceholder}
                  autoFocus={focusAt === null ? at === 0 : focusAt === at}
                  spellCheck={false}
                  onPointerDown={stopPointer}
                  onChange={(event) => rename(at, event.target.value)}
                  onKeyDown={editorKeys(finish, finish)}
                />
                {names.length > 1 ? (
                  <button className="daily-icon-button" type="button" aria-label={`${t.remove} ${shown[at]}`} title={t.remove} onClick={clickOnly(() => removeHabit(names, at))}>
                    <X size={11} strokeWidth={2.4} />
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <span className="daily-habits__name" title={shown[at]}>{shown[at]}</span>
                {week.map((day) => {
                  const done = data.habits[day.key]?.includes(at) ?? false;
                  const label = t.toggleHabit(shown[at] ?? "", day.name);
                  return (
                    <button
                      key={day.key}
                      className="daily-habits__cell"
                      type="button"
                      disabled={day.key > today}
                      data-on={done || undefined}
                      aria-pressed={done}
                      aria-label={label}
                      title={label}
                      onClick={clickOnly(() => toggleHabit(day.key, at))}
                    />
                  );
                })}
              </>
            )}
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}
