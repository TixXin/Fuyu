import { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "../../i18n";
import { clipboardImageUrl } from "./api";
import { useImageZoom } from "./useImageZoom";
import "./ClipboardImageViewer.css";

type ViewerProps = { id: string; thumbnail?: string; width: number; height: number; controls?: boolean };

export function ClipboardImageViewer({ id, thumbnail, width, height, controls = false }: ViewerProps) {
  const text = useTranslation().clipboard.previewWindow.zoom;
  const full = clipboardImageUrl(id);
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = loaded === full;
  const zoom = useImageZoom({ id, image: { width, height }, controls });
  const view = zoom.view;
  const layer = view ? { width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } : undefined;
  const classes = [
    "clipboard-picture",
    ready && "clipboard-picture--ready",
    view && "clipboard-picture--zoomed",
    zoom.pannable && "clipboard-picture--pannable",
    zoom.dragging && "clipboard-picture--dragging",
  ].filter(Boolean).join(" ");

  return (
    <div ref={zoom.ref} className={classes} {...zoom.handlers}>
      {thumbnail && !ready && <img className="clipboard-picture__thumb" src={thumbnail} alt="" aria-hidden="true" style={layer} />}
      <img className="clipboard-picture__full" src={full} alt="" decoding="async" onLoad={() => setLoaded(full)} style={layer} />
      {controls && (
        <div className="clipboard-zoom" role="toolbar" aria-label={text.bar}>
          <button type="button" className="clipboard-zoom__button" aria-label={text.zoomOut} title={`${text.zoomOut} (-)`} onClick={zoom.zoomOut}>
            <ZoomOut size={14} aria-hidden="true" />
          </button>
          <span className="clipboard-zoom__level" aria-live="polite">{text.level(zoom.percent)}</span>
          <button type="button" className="clipboard-zoom__button" aria-label={text.zoomIn} title={`${text.zoomIn} (+)`} onClick={zoom.zoomIn}>
            <ZoomIn size={14} aria-hidden="true" />
          </button>
          <span className="clipboard-zoom__divider" aria-hidden="true" />
          <button type="button" className="clipboard-zoom__button clipboard-zoom__button--text" aria-pressed={!view} title={`${text.fit} (0)`} onClick={zoom.fit}>{text.fit}</button>
          <button type="button" className="clipboard-zoom__button clipboard-zoom__button--text" aria-pressed={zoom.percent === 100} title={text.actualHint} onClick={zoom.actual}>{text.actual}</button>
        </div>
      )}
    </div>
  );
}
