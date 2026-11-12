import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { saveTranslationHandoff } from "../translation/storage";
import { listenScreenshotText } from "./api";

const PEEK_MS = 8_000;

export function useScreenshotText() {
  const t = useTranslation().screenshot;
  const [peek, setPeek] = useState<string | null>(null);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    let timer = 0;
    void listenScreenshotText((event) => {
      const text = event.payload.trim();
      if (text) saveTranslationHandoff(text, "");
      setPeek(text ? t.textCopied(text.replace(/\s+/g, " ")) : t.noText);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPeek(null), PEEK_MS);
    }).then((stop) => {
      if (didCancel) stop();
      else unlisten = stop;
    }).catch((error: unknown) => console.error("Failed to listen for screenshot text", error));
    return () => {
      didCancel = true;
      unlisten?.();
      window.clearTimeout(timer);
    };
  }, [t]);

  return peek;
}
