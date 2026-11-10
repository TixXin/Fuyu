import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { rewriteText, type RewriteTask } from "../translation/api";
import { loadSettings } from "../translation/storage";
import type { ClipboardHistoryItem } from "./api";

const TASKS: readonly RewriteTask[] = ["summarize", "polish", "grammar", "translate"];

/** The service, base URL and model the quick translation uses, from its saved settings. */
function translationService() {
  const settings = loadSettings();
  return {
    provider: settings.provider,
    baseUrl: settings.provider === "custom" ? settings.customBaseUrl.trim() || null : null,
    model: settings.models[settings.provider]?.trim() || null,
  };
}

type Result =
  | { task: RewriteTask; state: "loading" }
  | { task: RewriteTask; state: "done"; text: string }
  | { task: RewriteTask; state: "failed"; error: string };

/**
 * The actions panel's AI page (C38): summarize, polish, fix grammar or translate the entry with the
 * service set up for quick translation (its key, model and quota). The first Enter (or click) asks
 * and shows the answer; the second pastes it. Nothing is sent before that first Enter.
 */
export function ClipboardAiList({ item, onPaste }: { item: ClipboardHistoryItem; onPaste: (text: string) => void }) {
  const t = useTranslation();
  const text = t.clipboard.popup.actions;
  const errorText = useErrorText();
  const [selected, setSelected] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const request = useRef(0);

  const run = (index: number) => {
    const task = TASKS[index];
    if (!task) return;
    if (result?.task === task && result.state === "done") {
      onPaste(result.text);
      return;
    }
    if (result?.task === task && result.state === "loading") return;
    const id = ++request.current;
    setSelected(index);
    setResult({ task, state: "loading" });
    rewriteText(item.text ?? item.preview, task, translationService()).then(
      (answer) => { if (id === request.current) setResult({ task, state: "done", text: answer }); },
      (error: unknown) => { if (id === request.current) setResult({ task, state: "failed", error: errorText(error) }); },
    );
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + TASKS.length) % TASKS.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        run(selected);
      }
    };
    // Capture on the panel: its own handler stops keys on their way up.
    const panel = listRef.current?.closest(".clipboard-panel");
    panel?.addEventListener("keydown", onKey as EventListener, true);
    return () => panel?.removeEventListener("keydown", onKey as EventListener, true);
  });

  const shown = result === null ? text.aiHint : result.state === "loading" ? text.aiLoading : result.state === "failed" ? result.error : result.text;
  return (
    <>
      <ul ref={listRef} className="clipboard-panel__list" role="listbox" aria-label={text.aiTitle}>
        {TASKS.map((task, index) => (
          <li key={task} role="presentation">
            <button
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === selected}
              data-action={task}
              className={`clipboard-panel__action${index === selected ? " clipboard-panel__action--selected" : ""}`}
              onPointerMove={() => index !== selected && setSelected(index)}
              onClick={() => run(index)}
            >
              <Sparkles size={14} strokeWidth={1.9} aria-hidden="true" />
              <span className="clipboard-panel__label">{text.aiTasks[task]}</span>
              {result?.task === task && result.state === "done" && <span className="clipboard-panel__note">{text.aiPasteAgain}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="clipboard-panel__result" role="status">
        <span>{result?.state === "done" ? text.result : text.aiService}</span>
        <pre>{shown}</pre>
      </div>
    </>
  );
}
