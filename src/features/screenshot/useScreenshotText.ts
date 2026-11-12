import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { saveTranslationHandoff } from "../translation/storage";
import { listenScreenshotText } from "./api";

const PEEK_MS = 8_000;

/**
 * The text a screenshot's OCR read (Ctrl+Shift+3, or the toolbar's Read text), as a one-line peek
 * for the collapsed island; it is already on the clipboard. Handed to the translation window too,
 * so clicking the peek opens it there, as a selection translation's peek does.
 */
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
