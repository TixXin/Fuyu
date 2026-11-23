import { translatorV1 } from "@fuyu/plugin-services";
import { useRef, useState } from "react";
import { ArrowRight, Languages } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { useWidgetFlash } from "../../../components/island-widget/useWidgetFlash";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useErrorText, useTranslation } from "../../../i18n";
import { saveTranslationHandoff } from "../../../lib/translation-handoff/storage";
import { windowServices } from "../../plugin-kernel/services";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { copyTranslationResult } from "../api";
import { useTranslationSettings } from "../useTranslationSettings";
import { unwrapTranslatorError } from "../useTranslatorEngines";
import "./services";
import "./translateWidget.css";

const translator = windowServices.get(translatorV1);

type Result = { kind: "idle" } | { kind: "busy" } | { kind: "done"; source: string; text: string } | { kind: "failed"; text: string };

export function TranslateWidget() {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.islandWidgets;
  const [settings] = useTranslationSettings();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const { flash, track } = useWidgetFlash();
  const request = useRef(0);
  const direction = settings.direction === "zh-en" ? t.translator.zhEn : settings.direction === "en-zh" ? t.translator.enZh : t.translator.auto;
  const source = input.trim();
  const submit = async () => {
    if (!source) return;
    const id = ++request.current;
    setResult({ kind: "busy" });
    try {
      const { provider } = settings;
      const translated = await translator.translate({ text: source.slice(0, 5000), direction: settings.direction, engine: { engine: provider, model: settings.models[provider]?.trim() || null } });
      if (id === request.current) setResult({ kind: "done", source, text: translated.text });
    } catch (failure) {
      if (id === request.current) setResult({ kind: "failed", text: errorText(unwrapTranslatorError(failure)) });
    }
  };
  const openTranslator = () => {
    if (result.kind === "done") saveTranslationHandoff(result.source, result.text);
    else if (source) saveTranslationHandoff(source, "");
    runIslandAction(result.kind === "done" || source ? "translation.open-peek" : "translation.open");
  };
  return (
    <WidgetFrame icon={Languages} title={text.widgets.translate} aside={<>{direction}<WidgetOpenButton label={text.content.openTranslator} onOpen={openTranslator} /></>} className="translate-widget" flash={flash}>
      <div className="translate-widget__field">
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
        <button className="translate-widget__go" type="button" disabled={!source || result.kind === "busy"} aria-label={text.content.translateNow} title={text.content.translateNow} onClick={clickOnly(() => void submit())}>
          <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      {result.kind === "busy" ? <span className="translate-widget__result" data-state="busy">{text.content.translating}</span> : null}
      {result.kind === "failed" ? <span className="translate-widget__result" data-state="failed" title={result.text}>{result.text}</span> : null}
      {result.kind === "done" ? (
        <button
          className="translate-widget__result"
          type="button"
          title={`${result.text}\n${text.content.copyResult}`}
          onClick={clickOnly(() => void track(() => copyTranslationResult(result.text), { done: text.content.copied, failed: (failure) => errorText(failure) }))}
        >
          {result.text}
        </button>
      ) : null}
    </WidgetFrame>
  );
}
