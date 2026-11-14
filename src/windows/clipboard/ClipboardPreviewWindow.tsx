import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { ClipboardPopupPreview } from "../../features/clipboard/ClipboardPopupPreview";
import {
  clipboardImageUrl, listenClipboardPreviewClosing, pasteClipboardText, listenClipboardPreviewItem, listenClipboardPreviewOpened,
  type ClipboardPreviewPayload, type ClipboardPreviewSide,
} from "../../features/clipboard/api";
import { useWindowLight } from "../../features/appearance/useWindowLight";
import { useWindowAccent } from "../../features/appearance/useWindowAccent";
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

export function ClipboardPreviewWindow() {
  const t = useTranslation();
  const text = t.clipboard.popup.actions;
  const light = useWindowLight();
  useWindowAccent();
  const [payload, setPayload] = useState<ClipboardPreviewPayload | null>(null);
  const [side, setSide] = useState<ClipboardPreviewSide>("right");
  const [opened, setOpened] = useState(0);
  const [closing, setClosing] = useState(false);

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
      setOpened((count) => count + 1);
    }).then(keep);
    void listenClipboardPreviewClosing(() => setClosing(true)).then(keep);
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);

  const item = payload?.item;
  return (
    <div className={`clipboard-preview-window clipboard-preview-window--${side}${closing ? " clipboard-preview-window--out" : ""}${light ? " island-light" : ""}`}>
      <section key={opened} className="clipboard-popup clipboard-preview" aria-label={t.clipboard.popup.preview.label}>
        <span className="clipboard-preview__close">
          <kbd>{text.spaceKey}</kbd>
          {payload?.holding ? text.releaseToClose : text.closePreview}
        </span>
        {item && (
          <div key={item.id} className="clipboard-preview__content">
            <ClipboardPopupPreview
              entry={item}
              linkPreview={payload.linkPreview}
              onPasteText={(value) => void pasteClipboardText(value).catch((error: unknown) => console.error("Failed to paste from the preview", error))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
