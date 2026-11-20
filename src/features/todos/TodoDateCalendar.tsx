import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";
import { addDays } from "./schedule";
import { firstDayOfWeek, monthGrid, monthOf, moveDate, nextMonday, shiftMonth, weekdayNames } from "./datePicker";
import { useHolidayMarks } from "./useHolidayMarks";

export function TodoDateCalendar({
  selected,
  today,
  labels,
  onPick,
}: {
  selected: string;
  today: string;
  labels: { today: string; tomorrow: string };
  onPick: (date: string) => void;
}) {
  const t = useTranslation();
  const text = t.notebook;
  const firstDay = firstDayOfWeek(t.localeTag);
  const holidays = useHolidayMarks();
  const [cursor, setCursor] = useState(selected);
  const [month, setMonth] = useState(monthOf(selected));
  const gridRef = useRef<HTMLDivElement>(null);
  const focusCursor = useRef(true);

  useLayoutEffect(() => {
    if (!focusCursor.current) return;
    focusCursor.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [cursor]);

  const moveTo = (date: string) => {
    const next = date < today ? today : date;
    focusCursor.current = true;
    setCursor(next);
    setMonth(monthOf(next));
  };
  const showMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setCursor(next === monthOf(today) ? today : `${next}-01`);
  };
  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick(cursor);
      return;
    }
    const next = moveDate(cursor, event.key, firstDay);
    if (!next) return;
    event.preventDefault();
    moveTo(next);
  };

  const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(t.localeTag, options).format(new Date(`${date}T00:00:00`));
  const days = monthGrid(month, today, firstDay);
  const quick = [
    { key: "today", label: labels.today, date: today },
    { key: "tomorrow", label: labels.tomorrow, date: addDays(today, 1) },
    { key: "monday", label: text.dateNextMonday, date: nextMonday(today) },
  ];

  return (
    <>
      <div className="todo-date-calendar__head">
        <strong aria-live="polite">{dateLabel(`${month}-01`, { year: "numeric", month: "long" })}</strong>
        <button type="button" className="todo-date-calendar__nav" aria-label={text.previousMonth} title={text.previousMonth} disabled={month <= monthOf(today)} onClick={() => showMonth(-1)}>
          <ChevronLeft size={15} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button type="button" className="todo-date-calendar__nav" aria-label={text.nextMonth} title={text.nextMonth} onClick={() => showMonth(1)}>
          <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <div className="todo-date-calendar__weekdays" aria-hidden="true">
        {weekdayNames(t.localeTag, firstDay).map((name, index) => <span key={index}>{name}</span>)}
      </div>
      <div ref={gridRef} className="todo-date-calendar__grid" role="group" aria-label={dateLabel(`${month}-01`, { year: "numeric", month: "long" })} onKeyDown={onGridKey}>
        {days.map((day) => {
          const mark = holidays.get(day.date);
          const weekday = new Date(`${day.date}T00:00:00`).getDay();
          const className = [
            "todo-date-calendar__day",
            day.inMonth ? "" : "todo-date-calendar__day--outside",
            day.past ? "todo-date-calendar__day--past" : "",
            day.today ? "todo-date-calendar__day--today" : "",
            day.date === selected ? "todo-date-calendar__day--selected" : "",
            day.date === cursor ? "todo-date-calendar__day--cursor" : "",
            weekday === 0 || weekday === 6 ? "todo-date-calendar__day--weekend" : "",
            mark ? `todo-date-calendar__day--${mark}` : "",
          ].filter(Boolean).join(" ");
          const date = dateLabel(day.date, { month: "long", day: "numeric", weekday: "long" });
          const full = mark ? `${date}, ${mark === "off" ? t.calendar.offLabel : t.calendar.workLabel}` : date;
          return (
            <button
              key={day.date}
              type="button"
              className={className}
              data-date={day.date}
              tabIndex={day.date === cursor ? 0 : -1}
              disabled={day.past}
              aria-label={day.today ? `${labels.today}, ${full}` : full}
              aria-pressed={day.date === selected}
              aria-current={day.today ? "date" : undefined}
              title={day.past ? text.pastDay : undefined}
              onClick={() => onPick(day.date)}
            >
              {day.day}
              {mark && <span className="todo-date-calendar__mark" aria-hidden="true">{mark === "off" ? t.calendar.off : t.calendar.work}</span>}
            </button>
          );
        })}
      </div>
      <div className="todo-date-calendar__quick">
        {quick.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.date === selected ? "todo-date-calendar__chip todo-date-calendar__chip--on" : "todo-date-calendar__chip"}
            title={dateLabel(item.date, { month: "long", day: "numeric", weekday: "long" })}
            onClick={() => onPick(item.date)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
