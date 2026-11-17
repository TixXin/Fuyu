import type { Context } from "@fuyu/plugin-base";
import { useState } from "react";
import { POMODORO_MS, formatMs, isTicking, remainingMs } from "./model.ts";
import { text } from "./text.ts";
import { usePomodoro } from "./usePomodoro.ts";
import "./styles.css";

function PomodoroIcon({ size = 16 }: { size?: number | string }) {
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
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 3c1.2.9 2.1 1.2 3 1.2s1.8-.3 3-1.2" />
    </svg>
  );
}

export default function apply(ctx: Context) {
  function PomodoroPage() {
    const { state, error, start, stop } = usePomodoro(ctx);
    const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
    const running = isTicking(state.timer, state.at);
    const leftMs = state.timer ? remainingMs(state.timer, state.at) : POMODORO_MS;
    const totalMs = state.timer ? Math.max(1, state.timer.durationMs) : POMODORO_MS;
    const progress = running ? Math.min(100, Math.max(0, Math.round(((totalMs - leftMs) / totalMs) * 100))) : 0;
    const activeChoice = state.openTodos.some((item) => item.id === selectedTodoId) ? selectedTodoId : null;
    const subtitle = running ? state.activeLabel || text.focus : text.ready;

    return (
      <div className="fuyu-pomodoro">
        <div className="fuyu-pomodoro__header">
          <div className="fuyu-pomodoro__clock-group">
            <span className="fuyu-pomodoro__clock">{formatMs(leftMs)}</span>
            <span className="fuyu-pomodoro__subtitle">{subtitle}</span>
          </div>
          <span className="fuyu-pomodoro__rounds">{text.rounds(state.rounds)}</span>
        </div>

        <div className="fuyu-pomodoro__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="fuyu-pomodoro__bar-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="fuyu-pomodoro__actions">
          {running ? (
            <button type="button" className="fuyu-pomodoro__button" onClick={stop}>
              {text.stop}
            </button>
          ) : (
            <button type="button" className="fuyu-pomodoro__button" onClick={() => start(activeChoice)}>
              {activeChoice ? text.startWithTodo : text.start}
            </button>
          )}
        </div>

        {!running && (
          <div className="fuyu-pomodoro__todos">
            <p className="fuyu-pomodoro__section-label">{text.openTodos}</p>
            {state.openTodos.length === 0 ? (
              <p className="fuyu-pomodoro__note">{text.emptyTodos}</p>
            ) : (
              <ul className="fuyu-pomodoro__list">
                <li>
                  <button
                    type="button"
                    className={activeChoice === null ? "fuyu-pomodoro__todo fuyu-pomodoro__todo--selected" : "fuyu-pomodoro__todo"}
                    onClick={() => setSelectedTodoId(null)}
                  >
                    <span className="fuyu-pomodoro__todo-title">{text.noTodo}</span>
                  </button>
                </li>
                {state.openTodos.slice(0, 5).map((todo) => (
                  <li key={todo.id}>
                    <button
                      type="button"
                      className={activeChoice === todo.id ? "fuyu-pomodoro__todo fuyu-pomodoro__todo--selected" : "fuyu-pomodoro__todo"}
                      onClick={() => setSelectedTodoId(todo.id)}
                    >
                      <span className="fuyu-pomodoro__todo-title">{todo.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="fuyu-pomodoro__note">{error}</p>}
      </div>
    );
  }

  function PomodoroCollapsed() {
    const { state } = usePomodoro(ctx);
    if (!state.timer || !isTicking(state.timer, state.at)) return null;
    const leftMs = remainingMs(state.timer, state.at);
    return (
      <span className="fuyu-pomodoro-chip" title={state.activeLabel || text.title}>
        <PomodoroIcon size={12} />
        <span className="fuyu-pomodoro-chip__time">{formatMs(leftMs)}</span>
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: "pomodoro", component: PomodoroPage, icon: PomodoroIcon });
  ctx.slots.add("island.collapsed/v1", { id: "pomodoro-bar", width: 56, hideable: true, component: PomodoroCollapsed });
}
