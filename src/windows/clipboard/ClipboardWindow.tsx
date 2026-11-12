import { useCallback, useEffect, useState } from "react";
import { ClipboardPopup } from "../../features/clipboard/ClipboardPopup";
import { hideClipboardPopup, listenClipboardPopupBlur, listenClipboardPopupOpened, pasteClipboardItem, pasteClipboardSequence, pasteClipboardSnippet } from "../../features/clipboard/api";
import { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import { useWindowLight } from "../../features/appearance/useWindowLight";
import { useWindowAccent } from "../../features/appearance/useWindowAccent";
import "./ClipboardWindow.css";

const NO_SHORTCUT = () => {};
const reportError = (action: string) => (error: unknown) => console.error(`Failed to ${action}`, error);

export function ClipboardWindow() {
  const { clipboardHistory, toggleClipboardHistoryFavorite } = useClipboardHistory(NO_SHORTCUT);
  const [openCount, setOpenCount] = useState(0);
  const light = useWindowLight();
  useWindowAccent();

  const close = useCallback(() => {
    void hideClipboardPopup().catch((error: unknown) => console.error("Failed to hide the clipboard window", error));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenClipboardPopupOpened(() => setOpenCount((count) => count + 1)).then(keep);
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
        onPaste={(id, plain, options) => void pasteClipboardItem(id, plain, options).catch((error: unknown) => console.error("Failed to paste a clipboard entry", error))}
        onClose={close}
        onToggleFavorite={(id) => void toggleClipboardHistoryFavorite(id)}
        wide={clipboardHistory.settings.popupLayout === "wide"}
        capture={clipboardHistory.capture}
        linkPreview={clipboardHistory.settings.linkPreview === true}
        aiPrompts={clipboardHistory.settings.aiPrompts}
      />
    </div>
  );
}
