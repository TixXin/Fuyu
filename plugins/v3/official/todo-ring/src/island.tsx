import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState } from "react";
import { METHODS, percentOf, type UpcomingTodo } from "./model.ts";
import { PAGE_TITLE, text } from "./text.ts";
import { useRing } from "./useRing.ts";
import "./styles.css";

const PAGE_ID = "todo-ring";
const UNDO_MS = 6000;

function RingIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function Arc({ percent, r, box, className }: { percent: number; r: number; box: number; className: string }) {
  const c = box / 2;
  return (
    <svg className={`${className}__svg`} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
      <circle className={`${className}__track`} cx={c} cy={c} r={r} />
      {percent > 0 && (
        <circle className={`${className}__value`} cx={c} cy={c} r={r} pathLength={100} strokeDasharray={`${percent} 100`} />
      )}
    </svg>
  );
}

function TodoRow({ todo, clickable, onComplete }: { todo: UpcomingTodo; clickable: boolean; onComplete: (todo: UpcomingTodo) => void }) {
  const body = (
    <>
      <span className={todo.overdueFrom ? "fuyu-todo-ring__dot is-overdue" : "fuyu-todo-ring__dot"} aria-hidden="true" />
      <span className="fuyu-todo-ring__title">{todo.title}</span>
      {todo.overdueFrom && <span className="fuyu-todo-ring__when">{text.overdue(todo.overdueFrom)}</span>}
    </>
  );
  if (clickable && !todo.overdueFrom) {
    return (
      <button type="button" className="fuyu-todo-ring__item is-clickable" title={`${todo.title} · ${text.tapHint}`} onClick={() => onComplete(todo)}>
        {body}
      </button>
    );
  }
  return (
    <span className="fuyu-todo-ring__item" title={todo.overdueFrom ? `${todo.title} · ${text.overdueHint}` : todo.title}>
      {body}
    </span>
  );
}

export default function apply(ctx: Context) {
  function TodoRingPage() {
    const { state, failed, invoke } = useRing(ctx);
    const { settings } = state;
    const [undo, setUndo] = useState<UpcomingTodo | null>(null);

    useEffect(() => {
      if (!undo) return;
      const timer = setTimeout(() => setUndo(null), UNDO_MS);
      return () => clearTimeout(timer);
    }, [undo]);

    const percent = percentOf(state.done, state.total);
    const left = Math.max(0, state.total - state.done);
    const finished = state.total > 0 && left === 0;
    const shown = state.next.slice(0, settings.showCount);
    const extra = Math.max(0, left - shown.length);
    const listing = settings.showCount > 0;
    const loading = state.at === 0 && !state.error;

    const complete = (todo: UpcomingTodo) => {
      void invoke(METHODS.complete, { id: todo.id }, text.completeFailed).then((ok) => setUndo(ok ? todo : null));
    };
    const reopen = (todo: UpcomingTodo) => {
      setUndo(null);
      void invoke(METHODS.reopen, { id: todo.id }, text.completeFailed);
    };

    const rootClass = [
      "fuyu-todo-ring",
      listing ? "" : "is-ring-only",
      finished && settings.doneColor ? "is-done" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={rootClass}>
        <div className="fuyu-todo-ring__dial">
          <Arc percent={percent} r={50} box={120} className="fuyu-todo-ring" />
          <div className="fuyu-todo-ring__center">
            <strong className="fuyu-todo-ring__percent">{state.total === 0 ? "–" : `${percent}%`}</strong>
            <span className="fuyu-todo-ring__sub">{state.total === 0 ? "" : finished ? text.done : text.left(left)}</span>
          </div>
        </div>

        <div className="fuyu-todo-ring__side">
          {listing && <p className="fuyu-todo-ring__label">{settings.scope === "overdue" ? text.labelOverdue : text.label}</p>}

          {listing && shown.length > 0 && (
            <ul className="fuyu-todo-ring__list">
              {shown.map((todo) => (
                <li key={todo.id}>
                  <TodoRow todo={todo} clickable={settings.clickToComplete} onComplete={complete} />
                </li>
              ))}
            </ul>
          )}

          {state.error ? (
            <p className="fuyu-todo-ring__note is-error">{text.loadFailed}</p>
          ) : (
            !loading && state.total === 0 && <p className="fuyu-todo-ring__note">{text.empty}</p>
          )}
          {finished && <p className="fuyu-todo-ring__note">{text.allDone}</p>}
          {listing && extra > 0 && <p className="fuyu-todo-ring__note">{text.more(extra)}</p>}
          {undo && (
            <p className="fuyu-todo-ring__undo">
              <span className="fuyu-todo-ring__title">{text.completed(undo.title)}</span>
              <button type="button" className="fuyu-todo-ring__undo-btn" onClick={() => reopen(undo)}>
                {text.undo}
              </button>
            </p>
          )}
          {failed && <p className="fuyu-todo-ring__note is-error">{failed}</p>}
        </div>
      </div>
    );
  }

  function TodoRingCollapsed() {
    const { state } = useRing(ctx);
    const { settings } = state;
    if (!settings.showInBar || state.total <= 0) return null;
    const percent = percentOf(state.done, state.total);
    const left = Math.max(0, state.total - state.done);
    const finished = left === 0;
    const label =
      settings.barStyle === "ring-count"
        ? `${state.done}/${state.total}`
        : settings.barStyle === "left"
          ? finished
            ? text.barDone
            : text.barLeft(left)
          : "";
    const className = finished && settings.doneColor ? "fuyu-todo-ring-bar is-done" : "fuyu-todo-ring-bar";
    return (
      <span className={className} title={`${text.title} ${state.done}/${state.total}`}>
        <Arc percent={percent} r={7} box={20} className="fuyu-todo-ring-bar" />
        {label && <span className="fuyu-todo-ring-bar__text">{label}</span>}
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: TodoRingPage, icon: RingIcon });
  ctx.slots.add("island.collapsed/v1", {
    id: "todo-ring-bar",
    hideable: true,
    opens: PAGE_ID,
    component: TodoRingCollapsed,
  });
}
