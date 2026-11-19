import type { Context } from "@fuyu/plugin-base";
import { useState } from "react";
import { playChime } from "./chime.ts";
import { CheckIcon, ChevronIcon, PomodoroIcon } from "./icons.tsx";
import { METHODS, TOPICS, formatMs, isPaused, isTicking, phaseMinutes, remainingMs, type OpenTodoItem, type PomodoroSnapshot } from "./model.ts";
import { PAGE_TITLE, text } from "./text.ts";
import { useNow, usePomodoro } from "./usePomodoro.ts";
import "./styles.css";

const PAGE_ID = "pomodoro";

function subtitleOf(state: PomodoroSnapshot, paused: boolean): string {
  if (!state.phase) return text.ready;
  const parts = state.phase === "focus" ? [text.phase.focus, text.roundOf(state.rounds + 1), state.activeLabel] : [text.phase[state.phase]];
  if (paused) parts.unshift(text.paused);
  return parts.filter(Boolean).join(" · ");
}

function TodoPicker({ todos, chosen, onChoose, defaultOpen }: { todos: OpenTodoItem[]; chosen: OpenTodoItem | null; onChoose: (id: string | null) => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const pick = (id: string | null) => {
    onChoose(id);
    if (!defaultOpen) setOpen(false);
  };
  const row = (id: string | null, title: string) => (
    <li key={id ?? ""}>
      <button type="button" className={(chosen?.id ?? null) === id ? "fuyu-pomodoro__todo is-on" : "fuyu-pomodoro__todo"} onClick={() => pick(id)}>
        <span className="fuyu-pomodoro__todo-title">{title}</span>
        {(chosen?.id ?? null) === id && <CheckIcon size={12} />}
      </button>
    </li>
  );
  return (
    <div className="fuyu-pomodoro__todos">
      <button type="button" className="fuyu-pomodoro__picker" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="fuyu-pomodoro__todo-title">{chosen ? chosen.title : text.pickTodo}</span>
        <span className={open ? "fuyu-pomodoro__chevron is-open" : "fuyu-pomodoro__chevron"}>
          <ChevronIcon size={12} />
        </span>
      </button>
      {open &&
        (todos.length === 0 ? (
          <p className="fuyu-pomodoro__note">{text.emptyTodos}</p>
        ) : (
          <ul className="fuyu-pomodoro__list">
            {row(null, text.noTodo)}
            {todos.slice(0, 5).map((todo) => row(todo.id, todo.title))}
          </ul>
        ))}
    </div>
  );
}

export default function apply(ctx: Context) {
  function PomodoroPage() {
    const { state, error, invoke } = usePomodoro(ctx);
    const [chosenId, setChosenId] = useState<string | null>(null);
    const { settings } = state;
    const now = useNow(Boolean(state.timer && state.timer.runningSince !== null), state.at);
    const running = isTicking(state.timer, now);
    const paused = isPaused(state.timer, now);
    const active = state.phase !== null && (running || paused);
    const totalMs = state.timer ? Math.max(1, state.timer.durationMs) : phaseMinutes("focus", settings) * 60_000;
    const leftMs = active && state.timer ? remainingMs(state.timer, now) : totalMs;
    const progress = active ? Math.min(100, Math.max(0, Math.round(((totalMs - leftMs) / totalMs) * 100))) : 0;
    const chosen = state.openTodos.find((item) => item.id === chosenId) ?? null;
    const goalMet = settings.dailyGoal > 0 && state.rounds >= settings.dailyGoal;
    const onBreak = active && state.phase !== "focus";

    return (
      <div className="fuyu-pomodoro">
        <div className="fuyu-pomodoro__header">
          <div className="fuyu-pomodoro__clock-group">
            <span className={paused ? "fuyu-pomodoro__clock is-paused" : "fuyu-pomodoro__clock"}>{formatMs(leftMs)}</span>
            <span className="fuyu-pomodoro__subtitle">{active ? subtitleOf(state, paused) : text.ready}</span>
          </div>
          <span className={goalMet ? "fuyu-pomodoro__rounds is-met" : "fuyu-pomodoro__rounds"}>{text.today(state.rounds, settings.dailyGoal)}</span>
        </div>

        <div className="fuyu-pomodoro__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className={onBreak ? "fuyu-pomodoro__bar-fill is-break" : "fuyu-pomodoro__bar-fill"} style={{ width: `${progress}%` }} />
        </div>

        <div className="fuyu-pomodoro__actions">
          {active ? (
            <>
              <button type="button" className="fuyu-pomodoro__button" onClick={() => invoke(paused ? METHODS.resume : METHODS.pause)}>
                {paused ? text.resume : text.pause}
              </button>
              <button type="button" className="fuyu-pomodoro__button is-quiet" onClick={() => invoke(METHODS.stop)}>
                {text.stop}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="fuyu-pomodoro__button" onClick={() => invoke(METHODS.start, { todoId: chosen?.id ?? null })}>
                {text.start}
              </button>
              {state.breakDue && (
                <button type="button" className="fuyu-pomodoro__button is-quiet" onClick={() => invoke(METHODS.startBreak)}>
                  {text.takeBreak(state.breakDue, phaseMinutes(state.breakDue, settings))}
                </button>
              )}
            </>
          )}
        </div>

        {!active && <TodoPicker todos={state.openTodos} chosen={chosen} onChoose={setChosenId} defaultOpen={settings.todosExpanded} />}

        {error && <p className="fuyu-pomodoro__note">{error}</p>}
      </div>
    );
  }

  function PomodoroCollapsed() {
    const { state } = usePomodoro(ctx);
    const now = useNow(Boolean(state.timer && state.timer.runningSince !== null), state.at);
    const running = isTicking(state.timer, now);
    const paused = isPaused(state.timer, now);
    if (!state.settings.showInBar || !state.timer || !state.phase || !(running || paused)) return null;
    const onBreak = state.phase !== "focus";
    const className = ["fuyu-pomodoro-chip", paused ? "is-paused" : "", onBreak ? "is-break" : ""].filter(Boolean).join(" ");
    return (
      <span className={className} title={subtitleOf(state, paused)}>
        {onBreak ? <span className="fuyu-pomodoro-chip__lead">{text.barBreak}</span> : <PomodoroIcon size={12} />}
        <span className="fuyu-pomodoro-chip__time">{formatMs(remainingMs(state.timer, now))}</span>
      </span>
    );
  }

  ctx.host.on(TOPICS.chime, () => playChime());
  ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: PomodoroPage, icon: PomodoroIcon });
  ctx.slots.add("island.collapsed/v1", { id: "pomodoro-bar", hideable: true, opens: PAGE_ID, component: PomodoroCollapsed });
}
