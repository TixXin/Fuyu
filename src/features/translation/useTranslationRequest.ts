import { translatorV1 } from "@fuyu/plugin-services";
import { useCallback, type KeyboardEvent } from "react";
import { useErrorText, useTranslation } from "../../i18n";
import { windowServices } from "../plugin-kernel/services";
import { copyTranslationResult } from "./api";
import "./plugin/services";
import type { TranslationSettings } from "./storage";
import { unwrapTranslatorError } from "./useTranslatorEngines";

const translator = windowServices.get(translatorV1);

export function useTranslationRequest({
  input,
  settings,
  output,
  requestId,
  inputRef,
  setInput,
  setOutput,
  setError,
  setIsLoading,
  setDidCopy,
  onStart,
}: {
  input: string;
  settings: TranslationSettings;
  output: string;
  requestId: { current: number };
  inputRef: { current: HTMLTextAreaElement | null };
  setInput: (value: string) => void;
  setOutput: (value: string) => void;
  setError: (value: string) => void;
  setIsLoading: (value: boolean) => void;
  setDidCopy: (value: boolean) => void;
  onStart?: () => void;
}) {
  const t = useTranslation();
  const errorText = useErrorText();

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text) { setError(t.translator.emptySource); return; }
    if (Array.from(text).length > 5000) { setError(t.translator.tooLong); return; }
    onStart?.();
    const currentId = ++requestId.current;
    setError("");
    setOutput("");
    setIsLoading(true);
    try {
      const { provider } = settings;
      const result = await translator.translate({
        text,
        direction: settings.direction,
        engine: {
          engine: provider,
          model: settings.models[provider]?.trim() || null,
        },
      });
      if (currentId === requestId.current) setOutput(result.text);
    } catch (failure) {
      if (currentId === requestId.current) setError(errorText(unwrapTranslatorError(failure)));
    } finally {
      if (currentId === requestId.current) setIsLoading(false);
    }
  }, [input, onStart, requestId, setError, setIsLoading, setOutput, settings, t, errorText]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const copyResult = async () => {
    if (!output) return;
    try {
      await copyTranslationResult(output);
      setDidCopy(true);
    } catch (failure) { setError(errorText(failure)); }
  };

  const clearSource = () => {
    requestId.current += 1;
    setInput("");
    setOutput("");
    setError("");
    setDidCopy(false);
    setIsLoading(false);
    inputRef.current?.focus();
  };

  return { submit, handleInputKeyDown, copyResult, clearSource };
}
