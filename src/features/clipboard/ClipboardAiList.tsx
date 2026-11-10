import { useEffect, useRef, useState } from "react";
import { Sparkles, SquarePen } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { rewriteText, type RewriteTask } from "../translation/api";
import { loadSettings } from "../translation/storage";
import type { ClipboardAiPrompt, ClipboardHistoryItem } from "./api";

const TASKS = ["summarize", "polish", "grammar", "translate"] as const satisfies readonly RewriteTask[];

/** One line of the AI page: a built-in task, or a prompt of the user's own (C43). */
type Choice = { key: string; task: RewriteTask; prompt?: string; label: string; own: boolean };

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
  | { key: string; state: "loading"; text: string }
  | { key: string; state: "done"; text: string }
  | { key: string; state: "failed"; error: string };

/**
 * The actions panel's AI page (C38, C43): summarize, polish, fix grammar, translate, or a prompt
 * of the user's own (Settings → Clipboard), with the service set up for quick translation. The
 * first Enter (or click) asks, and the answer shows as it is written; the second pastes it.
 * Nothing is sent before that first Enter.
 */
export function ClipboardAiList({ item, prompts = [], onPaste }: { item: ClipboardHistoryItem; prompts?: readonly ClipboardAiPrompt[]; onPaste: (text: string) => void }) {
  const t = useTranslation();
  const text = t.clipboard.popup.actions;
  const errorText = useErrorText();
  const choices: Choice[] = [
    ...TASKS.map((task) => ({ key: task, task, label: text.aiTasks[task], own: false })),
    ...prompts.map((prompt) => ({ key: `own:${prompt.id}`, task: "custom" as const, prompt: prompt.prompt, label: prompt.title, own: true })),
  ];
  const [selected, setSelected] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const request = useRef(0);

  const run = (index: number) => {
    const choice = choices[index];
    if (!choice) return;
    if (result?.key === choice.key && result.state === "done") {
      onPaste(result.text);
      return;
    }
    if (result?.key === choice.key && result.state === "loading") return;
    const id = ++request.current;
    setSelected(index);
    setResult({ key: choice.key, state: "loading", text: "" });
    const onChunk = (piece: string) => {
      if (id === request.current) setResult((current) => (current?.state === "loading" ? { ...current, text: current.text + piece } : current));
    };
    rewriteText(item.text ?? item.preview, choice.task, translationService(), { prompt: choice.prompt, onChunk }).then(
      (answer) => { if (id === request.current) setResult({ key: choice.key, state: "done", text: answer }); },
      (error: unknown) => { if (id === request.current) setResult({ key: choice.key, state: "failed", error: errorText(error) }); },
    );
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length);
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

  const shown = result === null
    ? text.aiHint
    : result.state === "loading"
      ? result.text || text.aiLoading
      : result.state === "failed"
        ? result.error
        : result.text;
  return (
    <>
      <ul ref={listRef} className="clipboard-panel__list" role="listbox" aria-label={text.aiTitle}>
        {choices.map((choice, index) => (
          <li key={choice.key} role="presentation">
            {choice.own && (index === 0 || !choices[index - 1].own) && <span className="clipboard-panel__group">{text.aiOwn}</span>}
            <button
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === selected}
              data-action={choice.key}
              className={`clipboard-panel__action${index === selected ? " clipboard-panel__action--selected" : ""}`}
              onPointerMove={() => index !== selected && setSelected(index)}
              onClick={() => run(index)}
            >
              {choice.own ? <SquarePen size={14} strokeWidth={1.9} aria-hidden="true" /> : <Sparkles size={14} strokeWidth={1.9} aria-hidden="true" />}
              <span className="clipboard-panel__label">{choice.label}</span>
              {result?.key === choice.key && result.state === "done" && <span className="clipboard-panel__note">{text.aiPasteAgain}</span>}
            </button>
          </li>
        ))}
        {prompts.length === 0 && <li className="clipboard-panel__none">{text.aiOwnHint}</li>}
      </ul>
      <div className="clipboard-panel__result" role="status">
        <span>{result?.state === "done" ? text.result : text.aiService}</span>
        <pre>{shown}</pre>
      </div>
    </>
  );
}
