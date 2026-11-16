import { translatorV1 } from "@fuyu/plugin-services";
import { useEffect, useState } from "react";
import { useErrorText, useTranslation } from "../../i18n";
import { saveTranslationHandoff } from "../../lib/translation-handoff/storage";
import { windowServices } from "../plugin-kernel/services";
import { listenScreenshotText, listenScreenshotTranslate } from "./api";
import { serviceFailed } from "./serviceErrors";

const PEEK_MS = 8_000;
const translator = windowServices.get(translatorV1);

function oneLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function useScreenshotText() {
  const t = useTranslation();
  const errorText = useErrorText();
  const [peek, setPeek] = useState<string | null>(null);

  useEffect(() => {
    let didCancel = false;
    let request = 0;
    let timer = 0;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (didCancel ? stop() : stops.push(stop));

    const show = (id: number, line: string) => {
      if (didCancel || id !== request) return;
      setPeek(line);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (id === request) setPeek(null);
      }, PEEK_MS);
    };

    const failed = (error: unknown) => {
      if ((error as { code?: unknown } | null)?.code === "no-secret") return t.translator.configureSecret;
      return oneLine(serviceFailed(error, t.screenshot.translateOff, errorText));
    };

    void listenScreenshotText((event) => {
      const text = event.payload.trim();
      if (text) saveTranslationHandoff(text, "");
      show(++request, text ? t.screenshot.textCopied(oneLine(text)) : t.screenshot.noText);
    }).then(keep).catch((error: unknown) => console.error("Failed to listen for screenshot text", error));

    void listenScreenshotTranslate((event) => {
      const text = event.payload.trim();
      const id = ++request;
      if (!text) {
        show(id, t.translator.nothingToTranslate);
        return;
      }
      translator.translate({ text }).then(
        (answer) => {
          saveTranslationHandoff(text, answer.text);
          show(id, oneLine(answer.text));
        },
        (error: unknown) => {
          saveTranslationHandoff(text, "");
          show(id, failed(error));
        },
      );
    }).then(keep).catch((error: unknown) => console.error("Failed to listen for screenshot translation", error));

    return () => {
      didCancel = true;
      stops.forEach((stop) => stop());
      window.clearTimeout(timer);
    };
  }, [t, errorText]);

  return peek;
}
