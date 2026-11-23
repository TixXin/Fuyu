import type { CSSProperties } from "react";
import type { PanelIconComponent } from "../../../../components/island-widget/panelIcons";
import { useTranslation } from "../../../../i18n";
import { parsePageIcon } from "../../../../lib/settings/pageIconValue";
import type { ImageDraft } from "./ImageSourceTab";

type PageIconStageProps = {
  value: string;
  icon: PanelIconComponent;
  draft: ImageDraft | null;
  peeking: boolean;
  title: string;
};

function Glyph({ icon: Icon, draft, size }: { icon: PanelIconComponent; draft: ImageDraft | null; size: number }) {
  if (!draft) return <Icon size={size} strokeWidth={1.8} absoluteStrokeWidth />;
  if (!draft.mono) return <img className="page-glyph page-glyph--image" src={draft.data} width={size} height={size} alt="" />;
  const mask: CSSProperties = { width: size, height: size, WebkitMaskImage: `url(${draft.data})`, maskImage: `url(${draft.data})` };
  return <span className="page-glyph page-glyph--mask" style={mask} aria-hidden="true" />;
}

export function PageIconStage({ value, icon, draft, peeking, title }: PageIconStageProps) {
  const text = useTranslation().settings.islandPages.icons.picker.stage;
  const kind = draft ? "image" : parsePageIcon(value)?.kind ?? "name";
  const texty = kind === "text" || kind === "emoji" || value === "text";
  const zoom = value === "text" ? 16 : kind === "text" ? 22 : 28;
  const key = draft ? "draft" : value;
  const glyph = (size: number) => (
    <span key={key} className="page-icon-stage__glyph" data-texty={texty || undefined}>
      <Glyph icon={icon} draft={draft} size={size} />
    </span>
  );
  return (
    <div className="page-icon-stage" aria-label={text.label}>
      <div className="page-icon-stage__island" aria-hidden="true">
        <span className="page-icon-stage__tab">{glyph(15)}</span>
      </div>
      <div className="page-icon-stage__meta">
        <strong>{title}</strong>
        <span data-peeking={peeking || undefined} aria-live="polite">{peeking ? text.peeking : kind === "emoji" ? text.emojiNote : text.actual}</span>
      </div>
      <div className="page-icon-stage__zoom">
        <span className="page-icon-stage__tile" data-tone="dark" title={text.onDark}>{glyph(zoom)}</span>
        <span className="page-icon-stage__tile" data-tone="light" title={text.onLight}>{glyph(zoom)}</span>
      </div>
    </div>
  );
}
