import type { Context } from "@fuyu/plugin-base";
import { percentOf } from "./model.ts";
import { text } from "./text.ts";
import { useProgress } from "./useProgress.ts";
import "./styles.css";

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

export default function apply(ctx: Context) {
  function TodoRingPage() {
    const { progress, error, refresh, complete } = useProgress(ctx);
    const percent = percentOf(progress.done, progress.total);
    const left = Math.max(0, progress.total - progress.done);
    const extra = Math.max(0, left - progress.next.length);

    return (
      <div className="fuyu-todo-ring">
        <div className="fuyu-todo-ring__dial">
          <svg className="fuyu-todo-ring__svg" viewBox="0 0 120 120" aria-hidden="true">
            <circle className="fuyu-todo-ring__track" cx="60" cy="60" r="50" />
            {percent > 0 && (
              <circle
                className="fuyu-todo-ring__value"
                cx="60"
                cy="60"
                r="50"
                pathLength={100}
                strokeDasharray={`${percent} 100`}
              />
            )}
          </svg>
          <div className="fuyu-todo-ring__center">
            <strong className="fuyu-todo-ring__percent">{progress.total === 0 ? "–" : `${percent}%`}</strong>
            <span className="fuyu-todo-ring__sub">
              {progress.total === 0 ? "" : left === 0 ? text.done : text.left(left)}
            </span>
          </div>
        </div>

        <div className="fuyu-todo-ring__side">
          <div className="fuyu-todo-ring__top">
            <p className="fuyu-todo-ring__label">{text.label}</p>
            <button
              type="button"
              className="fuyu-todo-ring__refresh"
              title={text.refresh}
              aria-label={text.refresh}
              onClick={refresh}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>

          {progress.total > 0 && (
            <p className="fuyu-todo-ring__counts">
              <strong className="fuyu-todo-ring__done">{progress.done}</strong>
              <span>{text.total(progress.total)}</span>
            </p>
          )}

          {progress.next.length > 0 && (
            <ul className="fuyu-todo-ring__list">
              {progress.next.map((todo) => (
                <li key={todo.id}>
                  <button
                    type="button"
                    className="fuyu-todo-ring__item"
                    title={todo.title}
                    onClick={() => complete(todo.id)}
                  >
                    <span className="fuyu-todo-ring__dot" aria-hidden="true" />
                    <span className="fuyu-todo-ring__title">{todo.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {progress.total === 0 && <p className="fuyu-todo-ring__note">{text.empty}</p>}
          {progress.total > 0 && left === 0 && <p className="fuyu-todo-ring__note">{text.allDone}</p>}
          {extra > 0 && <p className="fuyu-todo-ring__note">{text.more(extra)}</p>}
          {error && <p className="fuyu-todo-ring__note">{error}</p>}
        </div>
      </div>
    );
  }

  function TodoRingCollapsed() {
    const { progress } = useProgress(ctx);
    if (progress.total <= 0) return null;
    const percent = percentOf(progress.done, progress.total);
    return (
      <span className="fuyu-todo-ring-bar" title={`${progress.done}/${progress.total}`}>
        <svg className="fuyu-todo-ring-bar__svg" viewBox="0 0 20 20" aria-hidden="true">
          <circle className="fuyu-todo-ring-bar__track" cx="10" cy="10" r="7" />
          {percent > 0 && (
            <circle
              className="fuyu-todo-ring-bar__value"
              cx="10"
              cy="10"
              r="7"
              pathLength={100}
              strokeDasharray={`${percent} 100`}
            />
          )}
        </svg>
        <span className="fuyu-todo-ring-bar__text">
          {progress.done}/{progress.total}
        </span>
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: "todo-ring", component: TodoRingPage, icon: RingIcon });
  ctx.slots.add("island.collapsed/v1", { id: "todo-ring-bar", width: 54, hideable: true, component: TodoRingCollapsed });
}
