import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardManager } from "../../features/clipboard/ClipboardManager";
import { ClipboardPopup } from "../../features/clipboard/ClipboardPopup";
import {
  hideClipboardPopup, hideClipboardPreview, listenClipboardPopupBlur, listenClipboardPopupMoved, listenClipboardPopupOpened, pasteClipboardItem, pasteClipboardSequence,
  pasteClipboardSnippet, sendClipboardPreview, setClipboardPopupExpanded, setClipboardPopupPin, showClipboardPreview, type ClipboardPeek,
} from "../../features/clipboard/api";
import { ClipboardTitleBar } from "./ClipboardTitleBar";
import { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import { useWindowLight } from "../../features/appearance/useWindowLight";
import { useWindowAccent } from "../../features/appearance/useWindowAccent";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import "./ClipboardWindow.css";

const NO_SHORTCUT = () => {};
const reportError = (action: string) => (error: unknown) => console.error(`Failed to ${action}`, error);

export function ClipboardWindow() {
  const { clipboardHistory, toggleClipboardHistoryFavorite } = useClipboardHistory(NO_SHORTCUT);
  const [openCount, setOpenCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  expandedRef.current = expanded;
  const light = useWindowLight();
  useWindowAccent();

  const close = useCallback(() => {
    void hideClipboardPopup().catch((error: unknown) => console.error("Failed to hide the clipboard window", error));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenClipboardPopupOpened(() => {
      setOpenCount((count) => count + 1);
      setExpanded(false);
    }).then(keep);
    void listenClipboardPopupBlur(() => {
      if (expandedRef.current) return;
      void hideClipboardPopup(true).catch((error: unknown) => console.error("Failed to hide the clipboard window", error));
    }).then(keep);
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [close]);

  const pinned = clipboardHistory.settings.popupPinned === true;
  const linkPreview = clipboardHistory.settings.linkPreview === true;
  const peekOpen = useRef(false);
  const [previewBroken, setPreviewBroken] = useState(false);

  const onPeek = useCallback((peek: ClipboardPeek | null) => {
    if (!peek) {
      if (!peekOpen.current) return;
      peekOpen.current = false;
      void hideClipboardPreview().catch(reportError("hide the clipboard preview"));
      return;
    }
    const sent = sendClipboardPreview({ ...peek, linkPreview });
    if (peekOpen.current) return;
    peekOpen.current = true;
    void sent.then(() => showClipboardPreview()).catch((error: unknown) => {
      console.error("Failed to show the clipboard preview", error);
      peekOpen.current = false;
      setPreviewBroken(true);
    });
  }, [linkPreview]);

  const toggleExpanded = useCallback(() => {
    const next = !expandedRef.current;
    if (next) peekOpen.current = false;
    void setClipboardPopupExpanded(next)
      .catch(reportError("resize the clipboard window"))
      .finally(() => setExpanded(next));
  }, []);

  const togglePin = useCallback(() => {
    void setClipboardPopupPin(!pinned).catch(reportError("pin the clipboard window"));
  }, [pinned]);

  useEffect(() => {
    if (!pinned) return;
    let cancelled = false;
    let timer: number | undefined;
    let stop: (() => void) | undefined;
    void listenClipboardPopupMoved(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void setClipboardPopupPin().catch(reportError("remember the clipboard window position"));
      }, 400);
    }).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop?.();
    };
  }, [pinned]);

  return (
    <div className={`clipboard-window${light ? " island-light" : ""}`}>
      <IconButtonTooltip scope="body" delay={300} />
      <ClipboardTitleBar pinned={pinned} expanded={expanded} onTogglePin={togglePin} onToggleExpanded={toggleExpanded} onClose={close} />
      {expanded ? (
        <ClipboardManager
          items={clipboardHistory.items}
          linkPreview={linkPreview}
          onToggleFavorite={(id) => void toggleClipboardHistoryFavorite(id)}
          onCollapse={toggleExpanded}
        />
      ) : (
      <ClipboardPopup
        items={clipboardHistory.items}
        snippets={clipboardHistory.snippets ?? []}
        onPasteSnippet={(id) => void pasteClipboardSnippet(id).catch(reportError("paste a snippet"))}
        onPasteSequence={(ids) => void pasteClipboardSequence(ids).catch(reportError("start a paste sequence"))}
        openCount={openCount}
        ownsWindow
        onPaste={(id, plain, options) => void pasteClipboardItem(id, plain, options).catch((error: unknown) => console.error("Failed to paste a clipboard entry", error))}
        onClose={close}
        onToggleFavorite={(id) => void toggleClipboardHistoryFavorite(id)}
        wide={clipboardHistory.settings.popupLayout === "wide"}
        capture={clipboardHistory.capture}
        linkPreview={linkPreview}
        pinFavorites={clipboardHistory.settings.pinFavorites !== false}
        onPeek={previewBroken ? undefined : onPeek}
        aiPrompts={clipboardHistory.settings.aiPrompts}
      />
      )}
    </div>
  );
}
