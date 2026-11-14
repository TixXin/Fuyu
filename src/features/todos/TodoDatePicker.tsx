import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "../../i18n";
import { addDays } from "./schedule";
import { placeCalendar } from "./datePicker";
import { TodoDateCalendar } from "./TodoDateCalendar";
import "./TodoDatePicker.css";

type Place = { left: number; top: number; ink: string; fill: string };

export function TodoDatePicker({
  value,
  today,
  disabled,
  onChange,
  labels,
}: {
  value: string | null;
  today: string;
  disabled: boolean;
  onChange: (date: string | null) => void;
  labels?: { today: string; tomorrow: string };
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isLater = value !== null && value > today;
  const names = { today: labels?.today ?? t.notebook.dateToday, tomorrow: labels?.tomorrow ?? t.notebook.dateTomorrow };
  const label = !isLater
    ? names.today
    : value === addDays(today, 1)
      ? names.tomorrow
      : new Intl.DateTimeFormat(t.localeTag, { month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`));

  const close = (refocus: boolean) => {
    setOpen(false);
    setPlace(null);
    if (refocus) buttonRef.current?.focus();
  };

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!open || !button || !popover) return;
    const anchor = button.getBoundingClientRect();
    const island = button.closest(".island")?.getBoundingClientRect();
    const bounds = {
      left: Math.max(0, island?.left ?? 0),
      top: Math.max(0, island?.top ?? 0),
      right: Math.min(window.innerWidth, island?.right ?? window.innerWidth),
      bottom: Math.min(window.innerHeight, island?.bottom ?? window.innerHeight),
    };
    const style = getComputedStyle(button);
    setPlace({
      ...placeCalendar(anchor, { width: popover.offsetWidth, height: popover.offsetHeight }, bounds),
      ink: style.getPropertyValue("--island-ink-rgb").trim() || "241, 240, 246",
      fill: style.getPropertyValue("--island-background-color").trim() || "#000",
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target as Node | null;
      if (target && (popoverRef.current?.contains(target) || buttonRef.current?.contains(target))) return;
      close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      close(true);
    };
    const onBlur = () => close(false);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", outside, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", outside, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [open]);

  const pick = (date: string) => {
    onChange(date > today ? date : null);
    close(true);
  };

  return (
    <span className="todo-date-picker">
      <button
        ref={buttonRef}
        className={`todo-date-picker__button${isLater ? " todo-date-picker__button--later" : ""}${open ? " todo-date-picker__button--open" : ""}`}
        type="button"
        disabled={disabled}
        aria-label={`${t.notebook.pickDate}: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <CalendarDays size={13} strokeWidth={2.2} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="todo-date-calendar"
          role="dialog"
          aria-label={t.notebook.pickDate}
          style={{ left: place?.left ?? -9999, top: place?.top ?? -9999, "--todo-cal-ink": place?.ink, "--todo-cal-fill": place?.fill } as CSSProperties}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next && !popoverRef.current?.contains(next) && !buttonRef.current?.contains(next)) close(false);
          }}
        >
          <TodoDateCalendar selected={isLater ? value : today} today={today} labels={names} onPick={pick} />
        </div>,
        buttonRef.current?.closest(".stage") ?? document.body,
      )}
    </span>
  );
}
