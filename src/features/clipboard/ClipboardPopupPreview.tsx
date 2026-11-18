import { Fragment } from "react";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem, ClipboardSnippet } from "./api";
import { ClipboardImageViewer } from "./ClipboardImageViewer";
import { ClipboardKindPane } from "./ClipboardKindPane";
import { contentKind } from "./contentKind";
import { previewMetaRows } from "./previewMeta";

export function ClipboardPopupPreview({ entry, snippet, linkPreview = false, imageZoom = false, onPasteText }: {
  entry?: ClipboardHistoryItem;
  snippet?: ClipboardSnippet;
  linkPreview?: boolean;
  imageZoom?: boolean;
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
  const image = item.kind === "image" ? item.image : item.kind === "files" && item.files?.length === 1 ? item.fileImage : undefined;
  const fullText = item.masked ? item.preview : item.text ?? item.preview;
  const kind = contentKind(item);
  const kindName = kind ? t.clipboard.popup.actions.kinds[kind.kind] : null;
  const head = image
    ? text.image(image.width, image.height, Math.max(1, Math.round(image.byteSize / 1024)))
    : item.kind === "files"
      ? text.files(item.files?.length ?? 1)
      : `${kindName ? `${kindName} · ` : ""}${text.text([...fullText].length)}`;
  const copiedAt = new Intl.DateTimeFormat(t.localeTag, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(item.copiedAt);
  const metaRows = previewMetaRows(item, copiedAt, {
    source: text.source,
    copiedAt: text.copiedAt,
    note: text.note,
    tags: text.tags,
    none: text.none,
    appName: t.settings.project.appName,
    screenshotSource: t.clipboard.popup.screenshotSource,
    otherDevice: t.clipboardPrivacy.otherDevice,
  });

  return (
    <aside className="clipboard-popup__pane" aria-label={text.label}>
      <span className="clipboard-popup__pane-head">{head}</span>
      {image ? (
        <div className="clipboard-popup__pane-image">
          <ClipboardImageViewer id={item.id} version={item.kind === "image" && item.editedAt ? item.hash : undefined} thumbnail={image.thumbnailDataUrl} width={image.width} height={image.height} controls={imageZoom} />
          {item.kind === "files" && <p className="clipboard-popup__pane-files">{item.files?.[0]}</p>}
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
        {metaRows.map((row) => (
          <Fragment key={row.key}>
            <dt>{row.label}</dt>
            <dd className={row.multiline ? "clipboard-popup__pane-meta-note" : undefined}>{row.value}</dd>
          </Fragment>
        ))}
      </dl>
    </aside>
  );
}
