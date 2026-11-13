import type { ReactNode } from "react";
import { Link2 } from "lucide-react";
import { useTranslation } from "../../i18n";
import { colorFormats, linkLabel, stripTracking, type ContentKind } from "./contentKind";
import { useLinkPreview } from "./useLinkPreview";

function highlightJson(value: unknown): ReactNode[] {
  const source = JSON.stringify(value, null, 2) ?? "";
  const parts: ReactNode[] = [];
  const token = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;
  let last = 0;
  for (const match of source.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(source.slice(last, index));
    const [whole, string, colon, literal, number] = match;
    const kind = string ? (colon ? "k" : "s") : literal ? "n" : number ? "n" : "p";
    parts.push(<span key={index} className={`clipboard-code__${kind}`}>{colon ? string : whole}</span>);
    if (colon) parts.push(colon);
    last = index + whole.length;
  }
  parts.push(source.slice(last));
  return parts;
}

export function ClipboardKindPane({ kind, source, linkPreview, onPasteText }: {
  kind: ContentKind;
  source: string;
  linkPreview: boolean;
  onPasteText: (text: string) => void;
}) {
  const t = useTranslation();
  const text = t.clipboard.popup.actions;
  const preview = useLinkPreview(kind.kind === "link" ? kind.url.href : null, linkPreview);

  if (kind.kind === "color") {
    const formats = colorFormats(kind.color);
    const { r, g, b, a } = kind.color;
    return (
      <div className="clipboard-kind">
        <div className="clipboard-kind__swatch" style={{ background: `rgba(${r}, ${g}, ${b}, ${a})` }}>{formats.hex}</div>
        <span className="clipboard-kind__hint">{text.colorPick}</span>
        <div className="clipboard-kind__formats">
          {([["HEX", formats.hex], ["RGB", formats.rgb], ["HSL", formats.hsl]] as const).map(([name, value]) => (
            <button key={name} type="button" tabIndex={-1} className="clipboard-kind__format" onClick={() => onPasteText(value)}>
              <b>{name}</b>{value}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (kind.kind === "link") {
    const cleaned = stripTracking(source.trim());
    return (
      <div className="clipboard-kind">
        <div className="clipboard-kind__link">
          <span className="clipboard-kind__favicon" aria-hidden="true">
            {preview?.icon ? <img src={preview.icon} alt="" /> : <Link2 size={18} />}
          </span>
          <div>
            <b>{preview?.title ?? linkLabel(kind.url)}</b>
            <span>{kind.url.href}</span>
          </div>
        </div>
        {cleaned !== source.trim() && (
          <button type="button" tabIndex={-1} className="clipboard-kind__format" onClick={() => onPasteText(cleaned)}>
            <b>{text.linkCleaned}</b>{cleaned}
          </button>
        )}
        {!linkPreview && <span className="clipboard-kind__hint">{text.linkOffline}</span>}
      </div>
    );
  }
  return <pre className="clipboard-popup__pane-body clipboard-code">{highlightJson(kind.value)}</pre>;
}
