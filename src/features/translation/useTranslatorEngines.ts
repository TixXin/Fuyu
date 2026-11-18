import { translatorV1, type TranslatorEngineInfo } from "@fuyu/plugin-services";
import { useEffect, useState } from "react";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { windowServices } from "../plugin-kernel/services";
import { hasTranslationSecret } from "./api";
import "./plugin/services";
import {
  DEFAULT_PROVIDER_MODELS,
  isBuiltinTranslationProvider,
  isLoopbackCustomBaseUrl,
  subscribeTranslationEngines,
  TRANSLATION_PROVIDERS,
  translationEngines,
  type BuiltinTranslationProvider,
  type TranslationProvider,
} from "./providers";

const translator = windowServices.get(translatorV1);

export function unwrapTranslatorError(error: unknown): unknown {
  const { code, message, data } = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
    data?: { reason?: unknown; args?: unknown; detail?: unknown };
  };
  if (typeof data?.reason !== "string" || data.reason === "failed") return error;
  return { code: data.reason, message: typeof message === "string" ? message : String(code), args: data.args, detail: data.detail };
}

export function useTranslatorEngines(provider: TranslationProvider, active = true, refreshTrigger = 0, customBaseUrl?: string) {
  const t = useTranslation();
  const { locale } = useLocale();
  const errorText = useErrorText();
  const [engines, setEngines] = useState<readonly TranslatorEngineInfo[]>([]);
  const [engineSecret, setEngineSecret] = useState(() => !isBuiltinTranslationProvider(provider) && translationEngines.has(provider));
  const [storedSecret, setStoredSecret] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    const offChanged = translator.on("changed", bump);
    const offLocal = subscribeTranslationEngines(bump);
    const offWatch = windowServices.watch(bump);
    return () => {
      void offChanged();
      offLocal();
      offWatch();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void Promise.all([
      translator.engines(),
      provider === "custom" ? hasTranslationSecret("custom") : Promise.resolve(null),
    ])
      .then(([result, customStored]) => {
        if (cancelled) return;
        const list = Array.isArray(result?.engines) ? result.engines : [];
        setEngines(list);
        const match = list.find((item) => item.engine === provider);
        const ready = match ? match.hasSecret === true : !isBuiltinTranslationProvider(provider);
        setEngineSecret(ready);
        setStoredSecret(customStored === null ? ready : customStored === true);
        setError("");
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(errorText(unwrapTranslatorError(failure)));
      });
    return () => {
      cancelled = true;
    };
  }, [active, provider, refreshTrigger, revision, errorText]);

  const setHasSecret = (next: boolean) => {
    setEngineSecret(next);
    setStoredSecret(next);
  };
  const hasStoredSecret = provider === "custom" ? storedSecret : engineSecret;
  const hasSecret = provider === "custom" && customBaseUrl !== undefined
    ? storedSecret || isLoopbackCustomBaseUrl(customBaseUrl)
    : engineSecret;

  const matched = engines.find((item) => item.engine === provider);
  const localCustom = translationEngines.get(provider);
  const builtin = isBuiltinTranslationProvider(provider);
  const label = builtin
    ? t.translator.providers[provider as BuiltinTranslationProvider]
    : matched?.label?.[locale] ?? localCustom?.label?.[locale] ?? provider;
  const defaultModel = builtin
    ? DEFAULT_PROVIDER_MODELS[provider as BuiltinTranslationProvider]
    : matched?.defaultModel ?? localCustom?.defaultModel;
  const options = [
    ...TRANSLATION_PROVIDERS.map((id) => ({ value: id as TranslationProvider, label: t.translator.providers[id] })),
    ...engines
      .filter((item) => !isBuiltinTranslationProvider(item.engine))
      .map((item) => ({ value: item.engine, label: item.label?.[locale] ?? item.engine })),
  ];

  return {
    engines,
    options,
    hasSecret,
    hasStoredSecret,
    setHasSecret,
    error,
    setError,
    isBuiltin: builtin,
    providerLabel: label,
    defaultModel,
  };
}
