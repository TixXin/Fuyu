import { useCallback, useRef, useState } from "react";
import { getClipboardHistory } from "../../features/clipboard/api";
import { loadScreenshotSettings } from "../../features/screenshot/storage";
import { loadSettings as loadTranslationSettings } from "../../features/translation/storage";
import type { TrayMenuShortcuts } from "./types";

const CLIPBOARD_RECHECK_MS = 5 * 60 * 1000;

function localShortcuts(clipboard: string | null): TrayMenuShortcuts {
  return {
    screenshot: loadScreenshotSettings().shortcuts.region || null,
    translate: loadTranslationSettings().shortcut || null,
    clipboard,
  };
}

export function useTrayShortcuts() {
  const [shortcuts, setShortcuts] = useState<TrayMenuShortcuts>(() => localShortcuts(null));
  const clipboard = useRef<{ shortcut: string | null; at: number } | null>(null);

  const refresh = useCallback(async () => {
    const cached = clipboard.current;
    if (!cached || Date.now() - cached.at > CLIPBOARD_RECHECK_MS) {
      try {
        const { settings } = await getClipboardHistory();
        clipboard.current = { shortcut: settings.shortcutEnabled ? settings.shortcut || null : null, at: Date.now() };
      } catch (error) {
        console.error("Failed to read the clipboard shortcut for the tray card", error);
      }
    }
    setShortcuts(localShortcuts(clipboard.current?.shortcut ?? null));
  }, []);

  return { shortcuts, refresh };
}
