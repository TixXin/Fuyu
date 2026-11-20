import { translatorV1 } from "@fuyu/plugin-services";
import { useRef, useState } from "react";
import { Languages } from "lucide-react";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useErrorText, useTranslation } from "../../../i18n";
import { windowServices } from "../../plugin-kernel/services";
import { copyTranslationResult } from "../api";
import { loadSettings } from "../storage";
import { unwrapTranslatorError } from "../useTranslatorEngines";
import "./services";
import "./translateWidget.css";

const translator = windowServices.get(translatorV1);

type Result = { kind: "idle" } | { kind: "busy" } | { kind: "done"; text: string } | { kind: "failed"; text: string };

export function TranslateWidget() {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.islandWidgets;
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const request = useRef(0);
  const settings = loadSettings();
  const direction = settings.direction === "zh-en" ? t.translator.zhEn : settings.direction === "en-zh" ? t.translator.enZh : t.translator.auto;
  const submit = async () => {
    const source = input.trim();
    if (!source) return;
    const id = ++request.current;
    setResult({ kind: "busy" });
    try {
      const { provider } = settings;
      const translated = await translator.translate({ text: source.slice(0, 5000), direction: settings.direction, engine: { engine: provider, model: settings.models[provider]?.trim() || null } });
      if (id === request.current) setResult({ kind: "done", text: translated.text });
    } catch (failure) {
      if (id === request.current) setResult({ kind: "failed", text: errorText(unwrapTranslatorError(failure)) });
    }
  };
  return (
    <WidgetFrame icon={Languages} title={text.widgets.translate} aside={direction} className="translate-widget">
      <input
        className="translate-widget__input"
        value={input}
        placeholder={text.content.translatePlaceholder}
        aria-label={text.widgets.translate}
        spellCheck={false}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          void submit();
        }}
      />
      {result.kind === "busy" ? <span className="translate-widget__result" data-state="busy">{text.content.translating}</span> : null}
      {result.kind === "failed" ? <span className="translate-widget__result" data-state="failed">{result.text}</span> : null}
      {result.kind === "done" ? (
        <button
          className="translate-widget__result"
          type="button"
          title={text.content.copyResult}
          onClick={(event) => {
            event.stopPropagation();
            void copyTranslationResult(result.text).catch((failure: unknown) => setResult({ kind: "failed", text: errorText(failure) }));
          }}
        >
          {result.text}
        </button>
      ) : null}
    </WidgetFrame>
  );
}
