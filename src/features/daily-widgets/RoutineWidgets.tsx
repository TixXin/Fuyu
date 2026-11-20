import { Droplets, Minus, Plus, Repeat, StickyNote } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { useLocale, useTranslation } from "../../i18n";
import { clickOnly } from "./clickOnly.ts";
import { dayKey, weekDays } from "./days.ts";
import { addCup, setNote, toggleHabit, useDaily, useNow } from "./store.ts";

const WATER_GOAL = 8;

export function WaterWidget() {
  const t = useTranslation().islandWidgets.daily;
  const data = useDaily();
  const today = dayKey(useNow(60_000));
  const cups = data.water[today] ?? 0;
  return (
    <WidgetFrame icon={Droplets} title={t.names.water} aside={t.cups(cups, WATER_GOAL)} className="daily-water">
      <div className="daily-water__body">
        <div className="daily-water__cup" aria-hidden="true">
          <b style={{ height: `${Math.min(1, cups / WATER_GOAL) * 100}%` }} />
        </div>
        <div className="daily-water__buttons">
          <button className="daily-button" type="button" aria-label={t.addCup} title={t.addCup} onClick={clickOnly(() => addCup(today, 1))}>
            <Plus size={13} strokeWidth={2.6} />
          </button>
          {cups ? (
            <button className="daily-button daily-button--plain" type="button" aria-label={t.removeCup} title={t.removeCup} onClick={clickOnly(() => addCup(today, -1))}>
              <Minus size={12} strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      </div>
    </WidgetFrame>
  );
}

export function HabitsWidget() {
  const t = useTranslation().islandWidgets.daily;
  const { locale } = useLocale();
  const data = useDaily();
  const now = useNow(60_000);
  const today = dayKey(now);
  const week = weekDays(now).map((date) => ({ key: dayKey(date), name: date.toLocaleDateString(locale, { weekday: "short" }) }));
  return (
    <WidgetFrame icon={Repeat} title={t.names.habits} aside={t.thisWeek} className="daily-habits">
      <div className="daily-habits__rows">
        {t.habitNames.map((habit, at) => (
          <div key={habit} className="daily-habits__row" data-habit={at}>
            <span className="daily-habits__name">{habit}</span>
            {week.map((day) => {
              const done = data.habits[day.key]?.includes(at) ?? false;
              return (
                <button
                  key={day.key}
                  className="daily-habits__cell"
                  type="button"
                  disabled={day.key > today}
                  data-on={done || undefined}
                  aria-pressed={done}
                  aria-label={t.toggleHabit(habit, day.name)}
                  title={t.toggleHabit(habit, day.name)}
                  onClick={clickOnly(() => toggleHabit(day.key, at))}
                />
              );
            })}
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

export function NoteWidget() {
  const t = useTranslation().islandWidgets.daily;
  const data = useDaily();
  return (
    <WidgetFrame icon={StickyNote} title={t.names.note} className="daily-note">
      <textarea
        className="daily-note__text"
        value={data.note}
        placeholder={t.notePlaceholder}
        aria-label={t.names.note}
        spellCheck={false}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setNote(event.target.value)}
      />
    </WidgetFrame>
  );
}
