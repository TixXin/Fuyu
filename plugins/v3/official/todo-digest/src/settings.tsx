import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { EMPTY_STATE, METHODS, TOPICS, type DigestState } from "./model.ts";
import { text } from "./text.ts";
import "./styles.css";

const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

function formatClock(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function apply(ctx: Context) {
  function DigestSection() {
    const [state, setState] = useState<DigestState>(EMPTY_STATE);
    const [writing, setWriting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const take = (next: DigestState) => setState((prev) => (next.at >= prev.at ? next : prev));
      const off = ctx.host.on(TOPICS.state, take);
      ctx.host.call<DigestState>(METHODS.state).then(take, (reason: unknown) => setError(errorText(reason)));
      return () => {
        void off();
      };
    }, []);

    const onWrite = useCallback(() => {
      setWriting(true);
      setError(null);
      ctx.host
        .call<DigestState>(METHODS.writeDigest)
        .then((next) => setState(next))
        .catch((reason: unknown) => setError(errorText(reason)))
        .finally(() => setWriting(false));
    }, []);

    const preview = state.open.slice(0, 5);
    const extra = state.open.length - preview.length;

    return (
      <section className="fuyu-todo-digest">
        <div className="fuyu-todo-digest__header">
          <div className="fuyu-todo-digest__meta">
            <h3 className="fuyu-todo-digest__title">{text.title}</h3>
            <p className="fuyu-todo-digest__summary">{text.summary(state.openCount, state.total)}</p>
          </div>
          <button type="button" className="fuyu-todo-digest__button" disabled={writing} onClick={onWrite}>
            {writing ? text.writing : text.write}
          </button>
        </div>

        {preview.length === 0 ? (
          <p className="fuyu-todo-digest__note">{text.empty}</p>
        ) : (
          <ul className="fuyu-todo-digest__list">
            {preview.map((todo) => (
              <li key={todo.id} className="fuyu-todo-digest__row">
                {todo.project && <span className="fuyu-todo-digest__tag">{todo.project}</span>}
                <span className="fuyu-todo-digest__label">{todo.title}</span>
              </li>
            ))}
          </ul>
        )}

        {extra > 0 && <p className="fuyu-todo-digest__note">{text.more(extra)}</p>}
        {state.lastWrittenAt !== null && <p className="fuyu-todo-digest__note">{text.writtenAt(formatClock(state.lastWrittenAt))}</p>}
        {error && <p className="fuyu-todo-digest__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "todo-digest", category: "pluginsV3", component: DigestSection });
}
