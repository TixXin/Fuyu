import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Flag, Repeat } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { RowMenu, type RowMenuItem } from "../../../components/list/RowMenu";
import { getLocalDateString } from "../../../utils/date";
import { placeCalendar } from "../datePicker";
import { TODO_RECURRENCE_KINDS } from "../recurrence";
import { TODO_COLORS, TODO_PRIORITIES, type TodoTags } from "../tags";
import { TodoDateCalendar } from "../TodoDateCalendar";
import type { TodoColor, TodoPriority, TodoRecurrence } from "../types";
import "./TodoTags.css";

type Tagged = {
  title: string;
  priority?: TodoPriority;
  color?: TodoColor;
  recurrence?: TodoRecurrence;
  deadline?: string;
};

type Place = { left: number; top: number; ink: string; fill: string };

const FLAG = { size: 13, strokeWidth: 2, "aria-hidden": true } as const;
const REPEAT = { size: 12, strokeWidth: 2.1, "aria-hidden": true } as const;

export function TodoTagMarks({ todo }: { todo: Tagged }) {
  if (!todo.priority && !todo.color && !todo.recurrence) return null;
  return (
    <span className="todo-tag-marks" aria-hidden="true">
      {todo.color && <span className="todo-tag-dot" data-color={todo.color} />}
      {todo.priority && <Flag {...FLAG} className={`todo-tag-flag todo-tag-flag--${todo.priority}`} />}
      {todo.recurrence && <Repeat {...REPEAT} className="todo-tag-repeat" />}
    </span>
  );
}

export function TodoTagMenu({ todo, today, onTag }: { todo: Tagged; today?: string; onTag: (tags: TodoTags) => void }) {
  const t = useTranslation();
  const text = t.todoIsland.tags;
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const effectiveToday = today ?? getLocalDateString();
  const tagged = Boolean(todo.priority || todo.color || todo.recurrence);

  useLayoutEffect(() => {
    const anchorEl = anchorRef.current;
    const popover = popoverRef.current;
    if (!calendarOpen || !anchorEl || !popover) return;
    const anchor = anchorEl.getBoundingClientRect();
    const island = anchorEl.closest(".island")?.getBoundingClientRect();
    const bounds = {
      left: Math.max(0, island?.left ?? 0),
      top: Math.max(0, island?.top ?? 0),
      right: Math.min(window.innerWidth, island?.right ?? window.innerWidth),
      bottom: Math.min(window.innerHeight, island?.bottom ?? window.innerHeight),
    };
    const style = getComputedStyle(anchorEl);
    setPlace({
      ...placeCalendar(anchor, { width: popover.offsetWidth, height: popover.offsetHeight }, bounds),
      ink: style.getPropertyValue("--island-ink-rgb").trim() || "241, 240, 246",
      fill: style.getPropertyValue("--island-background-color").trim() || "#000",
    });
  }, [calendarOpen]);

  useEffect(() => {
    if (!calendarOpen) return;
    const close = () => {
      setCalendarOpen(false);
      setPlace(null);
    };
    const outside = (event: Event) => {
      const target = event.target as Node | null;
      if (target && (popoverRef.current?.contains(target) || anchorRef.current?.contains(target))) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      close();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", outside, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", outside, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", close);
    };
  }, [calendarOpen]);

  const items: RowMenuItem[] = [
    {
      key: "deadline:pick",
      label: todo.deadline ? text.changeDeadline(todo.deadline.slice(5)) : text.deadline,
      icon: <CalendarClock {...REPEAT} />,
      onSelect: () => setCalendarOpen(true),
    },
    ...(todo.deadline ? [{ key: "deadline:none", label: text.clearDeadline, onSelect: () => onTag({ deadline: undefined }) }] : []),
    ...TODO_PRIORITIES.map((priority) => ({
      key: `priority:${priority}`,
      label: text.priority[priority],
      icon: <Flag {...FLAG} className={`todo-tag-flag todo-tag-flag--${priority}`} />,
      disabled: todo.priority === priority,
      onSelect: () => onTag({ priority }),
    })),
    ...(todo.priority ? [{ key: "priority:none", label: text.noPriority, onSelect: () => onTag({ priority: undefined }) }] : []),
    ...TODO_COLORS.map((color) => ({
      key: `color:${color}`,
      label: text.color[color],
      icon: <span className="todo-tag-dot" data-color={color} aria-hidden="true" />,
      disabled: todo.color === color,
      onSelect: () => onTag({ color }),
    })),
    ...(todo.color ? [{ key: "color:none", label: text.noColor, onSelect: () => onTag({ color: undefined }) }] : []),
    ...TODO_RECURRENCE_KINDS.map((kind) => ({
      key: `recurrence:${kind}`,
      label: text.recurrence[kind],
      icon: <Repeat {...REPEAT} className="todo-tag-repeat" />,
      disabled: todo.recurrence?.kind === kind && (todo.recurrence?.interval ?? 1) === 1,
      onSelect: () => onTag({ recurrence: { kind } }),
    })),
    ...(todo.recurrence ? [{ key: "recurrence:none", label: text.noRecurrence, onSelect: () => onTag({ recurrence: undefined }) }] : []),
  ];

  const selectedDate = todo.deadline && todo.deadline >= effectiveToday ? todo.deadline : effectiveToday;

  return (
    <>
      <RowMenu label={text.menu(todo.title)} items={items} triggerRef={anchorRef} buttonClassName={`todo-tag-button${tagged ? " todo-tag-button--set" : ""}`}>
        {tagged ? <TodoTagMarks todo={todo} /> : <Flag {...FLAG} className="todo-tag-flag" />}
      </RowMenu>
      {calendarOpen && createPortal(
        <div
          ref={popoverRef}
          className="todo-date-calendar"
          role="dialog"
          aria-label={text.deadline}
          style={{ left: place?.left ?? -9999, top: place?.top ?? -9999, "--todo-cal-ink": place?.ink, "--todo-cal-fill": place?.fill } as CSSProperties}
          onClick={(event) => event.stopPropagation()}
        >
          <TodoDateCalendar
            selected={selectedDate}
            today={effectiveToday}
            labels={{ today: t.todoIsland.today, tomorrow: t.todoIsland.tomorrow }}
            onPick={(date) => {
              onTag({ deadline: date });
              setCalendarOpen(false);
              setPlace(null);
            }}
          />
        </div>,
        anchorRef.current?.closest(".stage") ?? document.body,
      )}
    </>
  );
}
