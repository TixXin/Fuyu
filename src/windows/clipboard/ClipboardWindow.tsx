import { useCallback, useEffect, useState } from "react";
import { ClipboardPopup } from "../../features/clipboard/ClipboardPopup";
import { hideClipboardPopup, listenClipboardPopupBlur, listenClipboardPopupOpened, pasteClipboardItem, pasteClipboardSequence, pasteClipboardSnippet } from "../../features/clipboard/api";
import { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import { activeTone } from "../../features/appearance/themeMode";
import { STORAGE_KEY, loadSettings } from "../../features/appearance/storage";
import { useSystemDark } from "../../features/appearance/useResolvedTheme";
import "./ClipboardWindow.css";

const NO_SHORTCUT = () => {};
const reportError = (action: string) => (error: unknown) => console.error(`Failed to ${action}`, error);

/**
 * The clipboard window (C22.2), opened by the clipboard shortcut (or Win+V) unless the settings
 * keep it on the island. It stays loaded while hidden; the native side shows and places it.
 */
export function ClipboardWindow() {
  const { clipboardHistory, toggleClipboardHistoryFavorite } = useClipboardHistory(NO_SHORTCUT);
  const [openCount, setOpenCount] = useState(0);
  // Light or dark as the island is; the island saves its settings in the shared storage.
  const systemDark = useSystemDark();
  const [themeMode, setThemeMode] = useState(() => loadSettings().themeMode);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setThemeMode(loadSettings().themeMode);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const light = activeTone(themeMode, systemDark) === "light";

  const close = useCallback(() => {
    void hideClipboardPopup().catch((error: unknown) => console.error("Failed to hide the clipboard window", error));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    // The history hook keeps the entries current; opening only starts a fresh search.
    void listenClipboardPopupOpened(() => setOpenCount((count) => count + 1)).then(keep);
    // Clicking elsewhere closes it, like Windows' own clipboard history.
    void listenClipboardPopupBlur(close).then(keep);
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [close]);

  return (
    <div className={light ? "island-light" : undefined}>
      <ClipboardPopup
        items={clipboardHistory.items}
        snippets={clipboardHistory.snippets ?? []}
        onPasteSnippet={(id) => void pasteClipboardSnippet(id).catch(reportError("paste a snippet"))}
        onPasteSequence={(ids) => void pasteClipboardSequence(ids).catch(reportError("start a paste sequence"))}
        openCount={openCount}
        onPaste={(id, plain) => void pasteClipboardItem(id, plain).catch((error: unknown) => console.error("Failed to paste a clipboard entry", error))}
        onClose={close}
        onToggleFavorite={(id) => void toggleClipboardHistoryFavorite(id)}
        wide={clipboardHistory.settings.popupLayout === "wide"}
      />
    </div>
  );
}
