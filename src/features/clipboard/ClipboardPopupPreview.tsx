import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem, ClipboardSnippet } from "./api";
import { ClipboardKindPane } from "./ClipboardKindPane";
import { ClipboardPreviewImage } from "./ClipboardPreviewImage";
import { contentKind } from "./contentKind";
import { sourceName } from "./fileEntry";

export function ClipboardPopupPreview({ entry, snippet, linkPreview = false, onPasteText }: {
  entry?: ClipboardHistoryItem;
  snippet?: ClipboardSnippet;
  linkPreview?: boolean;
  onPasteText?: (text: string) => void;
}) {
  const t = useTranslation();
  const text = t.clipboard.popup.preview;
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
  const kind = contentKind(item);
  const kindName = kind ? t.clipboard.popup.actions.kinds[kind.kind] : null;
  const head = image
    ? text.image(image.width, image.height, Math.max(1, Math.round(image.byteSize / 1024)))
    : item.kind === "files"
      ? text.files(item.files?.length ?? 1)
      : `${kindName ? `${kindName} · ` : ""}${text.text([...fullText].length)}`;
  const copiedAt = new Intl.DateTimeFormat(t.localeTag, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(item.copiedAt);

  return (
    <aside className="clipboard-popup__pane" aria-label={text.label}>
      <span className="clipboard-popup__pane-head">{head}</span>
      {image ? (
        <div className="clipboard-popup__pane-image">
          <ClipboardPreviewImage id={item.id} thumbnail={image.thumbnailDataUrl} />
          {item.ocrText && <p><b>{text.ocr}</b>{item.ocrText}</p>}
        </div>
      ) : kind ? (
        <ClipboardKindPane kind={kind} source={fullText} linkPreview={linkPreview} onPasteText={(value) => onPasteText?.(value)} />
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
        <dd>{sourceName(item, t.settings.project.appName, t.clipboard.popup.screenshotSource) ?? text.none}</dd>
        <dt>{text.copiedAt}</dt>
        <dd>{copiedAt}</dd>
        <dt>{text.tags}</dt>
        <dd>{item.tags?.length ? item.tags.map((tag) => `#${tag}`).join(" ") : text.none}</dd>
      </dl>
    </aside>
  );
}
