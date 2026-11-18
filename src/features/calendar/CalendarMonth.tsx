import { Fragment, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import type { CalendarEvent } from "./api";
import type { WeekStartsOn } from "./calendarPrefs";
import { chineseDay } from "./lunar.ts";
import { dayMark, eventsOn, monthDays, monthWeekNumbers, namesTheDay, resolveWeekStart, startOfDay } from "./monthView.ts";
import "./CalendarMonth.css";

const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export function CalendarMonth({
  month,
  today,
  selected,
  events,
  showWeekNumbers = false,
  weekStartsOn = "auto",
  onSelect,
  onMonth,
}: {
  month: number;
  today: number;
  selected: number;
  events: readonly CalendarEvent[];
  showWeekNumbers?: boolean;
  weekStartsOn?: WeekStartsOn;
  onSelect: (day: number) => void;
  onMonth: (delta: number) => void;
}) {
  const t = useTranslation();
  const text = t.calendar;
  const lunar = useLocale().locale === "zh-CN";
  const shown = new Date(month);
  const keyed = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const sundayFirst = resolveWeekStart(weekStartsOn) === "sunday";
  const weekdays = sundayFirst ? [text.weekdays[6], ...text.weekdays.slice(0, 6)] : text.weekdays;
  const days = useMemo(
    () =>
      monthDays(month, weekStartsOn).map((day) => {
        const on = eventsOn(events, day);
        return { day, date: new Date(day), on: on.filter((event) => !namesTheDay(event)).length, mark: dayMark(on), chinese: chineseDay(new Date(day)) };
      }),
    [events, month, weekStartsOn],
  );
  const weeks = useMemo(
    () => (showWeekNumbers ? monthWeekNumbers(days.map((entry) => entry.day), weekStartsOn) : []),
    [days, showWeekNumbers, weekStartsOn],
  );
  const anchor = days.some(({ day }) => day === selected) ? selected : month;

  useEffect(() => {
    if (!keyed.current) return;
    keyed.current = false;
    grid.current?.querySelector<HTMLButtonElement>(".calendar-month__day--selected")?.focus();
  }, [selected, month]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const date = new Date(anchor);
    keyed.current = true;
    onSelect(startOfDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + step, 12).getTime()));
  };

  const elsewhere = selected !== today || shown.getMonth() !== new Date(today).getMonth() || shown.getFullYear() !== new Date(today).getFullYear();
  const rootClasses = [
    "calendar-month",
    !lunar && "calendar-month--plain",
    showWeekNumbers && "calendar-month--weeks",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClasses}>
      <div className="calendar-month__head">
        <h3 className="calendar-month__title">{text.monthTitle(shown.getFullYear(), shown.getMonth())}</h3>
        {elsewhere && (
          <button className="calendar-month__today" type="button" onClick={() => onSelect(today)}>
            {text.backToToday}
          </button>
        )}
        <button className="calendar-month__turn" type="button" aria-label={text.previousMonth} onClick={() => onMonth(-1)}>
          <ChevronLeft size={15} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button className="calendar-month__turn" type="button" aria-label={text.nextMonth} onClick={() => onMonth(1)}>
          <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <div className="calendar-month__weekdays" aria-hidden="true">
        {showWeekNumbers && <span className="calendar-month__week-head">{text.weekHeader}</span>}
        {weekdays.map((name, index) => <span key={index}>{name}</span>)}
      </div>
      <div className="calendar-month__grid" ref={grid} onKeyDown={onKeyDown}>
        {days.map(({ day, date, on, mark, chinese }, index) => {
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const classes = [
            "calendar-month__day",
            date.getMonth() !== shown.getMonth() && "calendar-month__day--outside",
            isWeekend && "calendar-month__day--weekend",
            day === today && "calendar-month__day--today",
            day === selected && "calendar-month__day--selected",
            mark && `calendar-month__day--${mark}`,
          ].filter(Boolean).join(" ");
          const title = [text.dayTitle(date), lunar ? chinese.lunar : "", lunar ? (chinese.festival ?? chinese.term ?? "") : "", mark === "off" ? text.offLabel : mark === "work" ? text.workLabel : ""]
            .filter(Boolean).join(" ");
          const button = (
            <button
              key={day}
              className={classes}
              type="button"
              tabIndex={day === anchor ? 0 : -1}
              aria-label={text.dayLabel(title, on)}
              aria-pressed={day === selected}
              aria-current={day === today ? "date" : undefined}
              onClick={() => onSelect(day)}
            >
              <span className="calendar-month__date">{date.getDate()}</span>
              {lunar && chinese.label && (
                <span className={`calendar-month__lunar${chinese.special ? " calendar-month__lunar--special" : ""}`}>{chinese.label}</span>
              )}
              {mark && <span className="calendar-month__mark" aria-hidden="true">{mark === "off" ? text.off : text.work}</span>}
              {on > 0 && <span className="calendar-month__dot" aria-hidden="true" />}
            </button>
          );
          if (!showWeekNumbers || index % 7 !== 0) return button;
          return (
            <Fragment key={`week-${day}`}>
              <span className="calendar-month__week" aria-hidden="true">{weeks[Math.floor(index / 7)]}</span>
              {button}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
