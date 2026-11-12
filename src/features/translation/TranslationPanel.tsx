import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clipboard, Copy, X } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { hasTranslationSecret, readTranslationClipboard } from "./api";
import { DEFAULT_PROVIDER_MODELS } from "./providers";
import { takeTranslationHandoff, type Direction } from "./storage";
import { useAutoTranslate } from "./useAutoTranslate";
import { useTranslationRequest } from "./useTranslationRequest";
import { useTranslationSettings } from "./useTranslationSettings";
import "./TranslationPanel.css";

export function TranslationPanel({ isOpen, onOpenSettings }: { isOpen: boolean; onOpenSettings: () => void }) {
  const t = useTranslation();
  const errorText = useErrorText();
  const [settings, setSettings] = useTranslationSettings();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [didCopy, setDidCopy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestId = useRef(0);
  const skipAutoSource = useRef<string | null>(null);
  const latest = useRef({ input, pasteOnOpen: settings.pasteClipboardOnOpen });
  latest.current = { input, pasteOnOpen: settings.pasteClipboardOnOpen };
  const text = t.translator;
  const directions: { value: Direction; label: string }[] = [
    { value: "auto", label: text.dirAuto }, { value: "zh-en", label: text.dirZhEn }, { value: "en-zh", label: text.dirEnZh },
  ];
  const directionHint = settings.direction === "zh-en" ? text.toEnglish : settings.direction === "en-zh" ? text.toChinese : text.autoHint;
  const providerName = text.providers[settings.provider];
  const model = settings.models[settings.provider] || DEFAULT_PROVIDER_MODELS[settings.provider];

  useEffect(() => {
    if (!isOpen) return;
    let didCancel = false;
    void hasTranslationSecret(settings.provider)
      .then((saved) => { if (!didCancel) setHasSecret(saved); })
      .catch((failure) => { if (!didCancel) setError(errorText(failure)); });
    return () => { didCancel = true; };
  }, [isOpen, settings.provider, errorText]);

  const fillSource = useCallback((source: string, result: string) => {
    requestId.current += 1;
    setInput(source);
    setOutput(result);
    setError("");
    setDidCopy(false);
    setIsLoading(false);
    skipAutoSource.current = result ? source.trim() : null;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let didCancel = false;
    const handoff = takeTranslationHandoff();
    if (handoff) fillSource(handoff.source, handoff.output);
    else if (latest.current.pasteOnOpen && !latest.current.input.trim()) {
      void readTranslationClipboard()
        .then((text) => { if (!didCancel && text && !latest.current.input.trim()) fillSource(text, ""); })
        .catch(() => {});
    }
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => { didCancel = true; window.cancelAnimationFrame(frame); };
  }, [fillSource, isOpen]);

  const paste = async () => {
    try {
      const text = await readTranslationClipboard();
      if (text) fillSource(text, "");
      else setError(t.translator.emptyClipboard);
      inputRef.current?.focus();
    } catch (failure) { setError(errorText(failure)); }
  };

  const noteAutoSource = useCallback(() => { skipAutoSource.current = input.trim(); }, [input]);
  const { submit, handleInputKeyDown, copyResult, clearSource } = useTranslationRequest({
    input, settings, output, requestId, inputRef, setInput, setOutput, setError, setIsLoading, setDidCopy,
    onStart: noteAutoSource,
  });
  const autoTranslateKey = `${settings.direction}\0${settings.provider}\0${settings.customBaseUrl}\0${settings.models[settings.provider] ?? ""}`;
  useAutoTranslate(isOpen && settings.autoTranslate && hasSecret && !isLoading, input, autoTranslateKey, skipAutoSource, submit);

  const setDirection = (direction: Direction) => setSettings((current) => ({ ...current, direction }));
  const count = [...input].length;

  return (
    <div className="translation-panel">
      <div className="translation-panel__bar">
        <div className="translation-panel__directions" role="radiogroup" aria-label={text.direction}>
          {directions.map(({ value, label }) => (
            <button key={value} type="button" role="radio" aria-checked={settings.direction === value}
              className={settings.direction === value ? "is-on" : undefined} disabled={isLoading} onClick={() => setDirection(value)}>
              {label}
            </button>
          ))}
        </div>
        <span className="translation-panel__hint">{directionHint}</span>
        <button type="button" className={`translation-panel__provider${hasSecret ? "" : " translation-panel__provider--no-key"}`} onClick={onOpenSettings} title={text.settings}>
          <span className="translation-panel__dot" aria-hidden="true" />
          <span className="translation-panel__provider-name">{model ? `${providerName} · ${model}` : providerName}</span>
        </button>
      </div>
      <div className="translation-panel__panes">
        <div className="translation-panel__pane translation-panel__pane--source">
          <span className="translation-panel__label">{text.source}</span>
          <textarea ref={inputRef} aria-label={text.source} value={input} placeholder={text.panelPlaceholder} onKeyDown={handleInputKeyDown} onChange={(event) => { setInput(event.target.value); setError(""); setDidCopy(false); }} />
          <div className="translation-panel__foot">
            <span className="translation-panel__count">{count > 0 ? text.charCount(count) : ""}</span>
            <button type="button" className="translation-panel__icon" onClick={() => void paste()} aria-label={text.paste} title={text.paste}><Clipboard size={15} /></button>
            <button type="button" className="translation-panel__icon" onClick={clearSource} disabled={!input} aria-label={text.clearSource} title={text.clearSource}><X size={15} /></button>
            <button type="button" className="translation-panel__primary" onClick={() => void submit()} disabled={isLoading || !input.trim()}>
              {text.translate}<kbd aria-hidden="true">Enter</kbd>
            </button>
          </div>
        </div>
        <div className="translation-panel__pane translation-panel__pane--result" aria-live="polite" aria-busy={isLoading} aria-label={text.result}>
          <span className="translation-panel__label">{text.result}</span>
          {isLoading ? (
            <div className="translation-panel__skeleton" aria-label={text.loading}><i /><i /><i /></div>
          ) : error ? (
            <div className="translation-panel__state translation-panel__state--error" role="alert">
              <strong>{error}</strong>
              <div className="translation-panel__state-actions">
                {input.trim() && <button type="button" className="translation-panel__ghost" onClick={() => void submit()}>{text.retry}</button>}
                <button type="button" className="translation-panel__ghost" onClick={onOpenSettings}>{text.openSettings}</button>
              </div>
            </div>
          ) : !hasSecret && !output ? (
            <div className="translation-panel__state">
              <strong>{text.noSecretTitle(providerName)}</strong>
              <span>{text.noSecretBody}</span>
              <div className="translation-panel__state-actions">
                <button type="button" className="translation-panel__ghost" onClick={onOpenSettings}>{text.openSettings}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="translation-panel__output">{output || <span className="translation-panel__empty">{text.emptyResult}</span>}</div>
              <div className="translation-panel__foot">
                {didCopy && <span className="translation-panel__copied">{text.copied}</span>}
                <button type="button" className="translation-panel__icon" onClick={() => void copyResult()} disabled={!output} aria-label={didCopy ? text.copied : text.copy} title={text.copy}>{didCopy ? <Check size={15} /> : <Copy size={15} />}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
