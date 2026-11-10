import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { getClipboardImagePreview, type ClipboardHistoryItem, type ClipboardSnippet } from "./api";

// Larger images already read this time the window has run; the native side scales them each time.
const previews = new Map<string, Promise<string | null>>();

function useImagePreview(item: ClipboardHistoryItem | undefined) {
  const id = item?.kind === "image" ? item.id : null;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!id) return;
    let request = previews.get(id);
    if (!request) {
      request = getClipboardImagePreview(id).catch(() => null);
      previews.set(id, request);
    }
    let cancelled = false;
    void request.then((next) => { if (!cancelled) setUrl(next); });
    return () => { cancelled = true; };
  }, [id]);
  return url;
}

/**
 * The wide clipboard window's right side: the picked entry in full, so it can be checked before it
 * is pasted. Text wraps and scrolls, an image shows large with the text read in it, files are
 * listed; a masked key stays masked. Under it, where and when it was copied and its tags.
 */
export function ClipboardPopupPreview({ entry, snippet }: { entry?: ClipboardHistoryItem; snippet?: ClipboardSnippet }) {
  const t = useTranslation();
  const text = t.clipboard.popup.preview;
  const imageUrl = useImagePreview(entry);
  if (!entry && !snippet) return <aside className="clipboard-popup__pane" aria-label={text.label} />;

  if (snippet) {
    return (
      <aside className="clipboard-popup__pane" aria-label={text.label}>
        <span className="clipboard-popup__pane-head">{snippet.title}</span>
        <div className="clipboard-popup__pane-body">{snippet.text}</div>
      </aside>
    );
  }
  const item = entry as ClipboardHistoryItem;
  const image = item.kind === "image" ? item.image : undefined;
  const fullText = item.masked ? item.preview : item.text ?? item.preview;
  const head = image
    ? text.image(image.width, image.height, Math.max(1, Math.round(image.byteSize / 1024)))
    : item.kind === "files"
      ? text.files(item.files?.length ?? 1)
      : text.text([...fullText].length);
  const copiedAt = new Intl.DateTimeFormat(t.localeTag, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(item.copiedAt);

  return (
    <aside className="clipboard-popup__pane" aria-label={text.label}>
      <span className="clipboard-popup__pane-head">{head}</span>
      {image ? (
        <div className="clipboard-popup__pane-image">
          {(imageUrl ?? image.thumbnailDataUrl) && <img src={imageUrl ?? image.thumbnailDataUrl} alt="" />}
          {item.ocrText && <p><b>{text.ocr}</b>{item.ocrText}</p>}
        </div>
      ) : item.kind === "files" ? (
        <ul className="clipboard-popup__pane-body clipboard-popup__pane-files">
          {(item.files ?? [item.preview]).map((path) => <li key={path}>{path}</li>)}
        </ul>
      ) : (
        <div className={`clipboard-popup__pane-body${item.masked ? " clipboard-popup__pane-body--mono" : ""}`}>
          {fullText}
          {item.masked && <p className="clipboard-popup__pane-note">{text.masked}</p>}
        </div>
      )}
      <dl className="clipboard-popup__pane-meta">
        <dt>{text.source}</dt>
        <dd>{item.source?.name ?? text.none}</dd>
        <dt>{text.copiedAt}</dt>
        <dd>{copiedAt}</dd>
        <dt>{text.tags}</dt>
        <dd>{item.tags?.length ? item.tags.map((tag) => `#${tag}`).join(" ") : text.none}</dd>
      </dl>
    </aside>
  );
}
