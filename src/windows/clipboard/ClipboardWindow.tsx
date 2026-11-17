import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardManager } from "../../features/clipboard/ClipboardManager";
import { ClipboardPopup } from "../../features/clipboard/ClipboardPopup";
import {
  hideClipboardPopup, hideClipboardPreview, listenClipboardPopupBlur, listenClipboardPopupMoved, listenClipboardPopupOpened, listenClipboardPreviewReport,
  pasteClipboardItem, pasteClipboardSequence, pasteClipboardSnippet, sendClipboardPreview, setClipboardPopupExpanded, setClipboardPopupPin,
  showClipboardPreview, type ClipboardPeek, type ClipboardPreviewPayload,
} from "../../features/clipboard/api";
import { ClipboardTitleBar } from "./ClipboardTitleBar";
import { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import { useWindowLight } from "../../lib/theme/useWindowLight";
import { afterPaint } from "./afterPaint";
import { reportClipboardPopupFirstFrame } from "./api";
import { useClipboardAccent } from "./useClipboardAccent";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import "./ClipboardWindow.css";

const NO_SHORTCUT = () => {};
const DEFER_WHILE_HIDDEN = { deferWhileHidden: true };
const reportError = (action: string) => (error: unknown) => console.error(`Failed to ${action}`, error);

export function ClipboardWindow() {
  const { clipboardHistory, toggleClipboardHistoryFavorite, reloadIfStale } = useClipboardHistory(NO_SHORTCUT, DEFER_WHILE_HIDDEN);
  const [openCount, setOpenCount] = useState(0);
  const openedAt = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  expandedRef.current = expanded;
  const light = useWindowLight();
  useClipboardAccent(openCount);

  const close = useCallback(() => {
    void hideClipboardPopup().catch((error: unknown) => console.error("Failed to hide the clipboard window", error));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenClipboardPopupOpened((trace) => {
      const at = performance.now();
      void reloadIfStale(() => {
        openedAt.current = trace ? at : null;
        setOpenCount((count) => count + 1);
        setExpanded(false);
      });
    }).then(keep);
    void listenClipboardPopupBlur(() => {
      if (expandedRef.current) return;
      void hideClipboardPopup(true).catch((error: unknown) => console.error("Failed to hide the clipboard window", error));
    }).then(keep);
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [close, reloadIfStale]);

  useEffect(() => {
    const at = openedAt.current;
    if (at === null) return;
    return afterPaint(() => {
      if (openedAt.current !== at) return;
      openedAt.current = null;
      void reportClipboardPopupFirstFrame({ sinceOpenedMs: performance.now() - at }).catch(reportError("report the clipboard first frame"));
    });
  }, [openCount]);

  const pinned = clipboardHistory.settings.popupPinned === true;
  const linkPreview = clipboardHistory.settings.linkPreview === true;
  const peekOpen = useRef(false);
  const latestPeek = useRef<ClipboardPreviewPayload | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenClipboardPreviewReport((report) => {
      if (report.type !== "ready") return;
      const current = latestPeek.current;
      if (!peekOpen.current || !current) return;
      void sendClipboardPreview(current)
        .then(() => {
          if (peekOpen.current) return showClipboardPreview();
        })
        .catch(reportError("sync the clipboard preview"));
    }).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const onPeek = useCallback((peek: ClipboardPeek | null) => {
    if (!peek) {
      latestPeek.current = null;
      if (!peekOpen.current) return;
      peekOpen.current = false;
      void hideClipboardPreview().catch(reportError("hide the clipboard preview"));
      return;
    }
    const payload = { ...peek, linkPreview };
    latestPeek.current = payload;
    const sent = sendClipboardPreview(payload);
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
    if (next) {
      latestPeek.current = null;
      peekOpen.current = false;
    }
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
