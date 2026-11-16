import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { ClipboardPopupPreview } from "../../features/clipboard/ClipboardPopupPreview";
import { ClipboardPreviewEditor } from "../../features/clipboard/ClipboardPreviewEditor";
import { useClipboardPreviewCommand } from "../../features/clipboard/useClipboardPreviewCommand";
import {
  clipboardImageUrl, listenClipboardPreviewClosing, pasteClipboardText, listenClipboardPreviewItem, listenClipboardPreviewLayout, listenClipboardPreviewOpened,
  reportClipboardPreview, setClipboardPreviewSize, type ClipboardPreviewPayload, type ClipboardPreviewSide,
} from "../../features/clipboard/api";
import type { ClipboardPreviewReport, ClipboardPreviewSize, ClipboardPreviewSizeRequest } from "../../features/clipboard/previewCommands";
import { useWindowLight } from "../../lib/theme/useWindowLight";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { ClipboardPreviewBar } from "./ClipboardPreviewBar";
import { ClipboardPreviewEdges } from "./ClipboardPreviewEdges";
import { ClipboardImageEditor } from "./ClipboardImageEditor";
import "../../features/clipboard/ClipboardPopup.css";
import "./ClipboardPreviewWindow.css";

const prefetched = new Set<string>();

function prefetch(ids: readonly string[]) {
  for (const id of ids) {
    if (prefetched.has(id)) continue;
    prefetched.add(id);
    const image = new Image();
    image.decoding = "async";
    image.src = clipboardImageUrl(id);
  }
}

const report = (message: ClipboardPreviewReport) => void reportClipboardPreview(message).catch((error: unknown) => console.error("Failed to report to the clipboard window", error));

export function ClipboardPreviewWindow() {
  const t = useTranslation();
  const text = t.clipboard.popup.actions;
  const light = useWindowLight();
  useWindowAccent();
  const [payload, setPayload] = useState<ClipboardPreviewPayload | null>(null);
  const [side, setSide] = useState<ClipboardPreviewSide>("right");
  const [size, setSize] = useState<ClipboardPreviewSize>("standard");
  const [pinned, setPinned] = useState(false);
  const [opened, setOpened] = useState(0);
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenClipboardPreviewItem((next) => {
      setPayload(next);
      prefetch(next.prefetch);
    }).then(keep);
    void listenClipboardPreviewOpened((next) => {
      setSide(next);
      setClosing(false);
      setPinned(false);
      setEditing(false);
      setOpened((count) => count + 1);
    }).then(keep);
    void listenClipboardPreviewLayout((layout) => {
      setSide(layout.side);
      setSize(layout.size);
    }).then(keep);
    void listenClipboardPreviewClosing(() => setClosing(true)).then(keep);
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);

  const changeSize = useCallback((next: ClipboardPreviewSizeRequest) => {
    void setClipboardPreviewSize(next).catch((error: unknown) => console.error("Failed to resize the clipboard preview", error));
  }, []);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    report({ type: "pinned", pinned: next });
  };

  const item = payload?.item;
  const editable = item?.kind === "text" || (item?.kind === "image" && Boolean(item.image));
  useClipboardPreviewCommand((command) => {
    if (command.type === "edit" && editable) setEditing(true);
  });

  const words = t.clipboard.previewWindow;
  const hint = editing && editable
    ? { key: "Esc", text: text.cancel }
    : pinned
    ? { key: "Esc", text: words.pinnedHint }
    : { key: text.spaceKey, text: payload?.holding ? (payload.stay ? words.releaseToKeep : text.releaseToClose) : text.closePreview };
  return (
    <div
      className={`clipboard-preview-window clipboard-preview-window--${side} clipboard-preview-window--${size}${closing ? " clipboard-preview-window--out" : ""}${light ? " island-light" : ""}`}
      onPointerEnter={() => report({ type: "pointer", inside: true })}
      onPointerLeave={() => report({ type: "pointer", inside: false })}
    >
      <section key={opened} className="clipboard-popup clipboard-preview" aria-label={t.clipboard.popup.preview.label}>
        <ClipboardPreviewBar
          hint={hint}
          size={size}
          pinned={pinned}
          editing={editing}
          editLabel={item?.kind === "image" ? words.image.edit : undefined}
          onEdit={editable ? () => setEditing(true) : undefined}
          onSize={changeSize}
          onTogglePin={togglePin}
          onClose={() => report({ type: "close" })}
        />
        {item && editing && editable && (item.kind === "image"
          ? <ClipboardImageEditor key={item.id} item={item} onDone={() => setEditing(false)} />
          : <ClipboardPreviewEditor key={item.id} item={item} onDone={() => setEditing(false)} />)}
        {item && !(editing && editable) && (
          <div key={item.id} className="clipboard-preview__content">
            <ClipboardPopupPreview
              entry={item}
              imageZoom
              linkPreview={payload.linkPreview}
              onPasteText={(value) => void pasteClipboardText(value).catch((error: unknown) => console.error("Failed to paste from the preview", error))}
            />
          </div>
        )}
      </section>
      <ClipboardPreviewEdges />
    </div>
  );
}
