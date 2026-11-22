import type { CSSProperties, ReactNode } from "react";
import { AudioLines, BatteryMedium, Camera, Download, Inbox, LayoutGrid, Mail, Puzzle, Sparkles, Timer } from "lucide-react";
import { USAGE_PROVIDERS } from "../../../features/claude-usage/usageRing";
import { useTranslation } from "../../../i18n";
import type { CollapsedPlacement } from "../../../lib/settings/collapsedItems";
import type { IslandSettings } from "../../../lib/settings/types";
import { hexToRgba } from "../../../lib/settings/settings";
import "./IslandBarPreview.css";

const ICONS: Record<string, ReactNode> = {
  mail: <Mail size={13} strokeWidth={2.2} />,
  update: <Download size={13} strokeWidth={2.2} />,
  "device-use": <Camera size={13} strokeWidth={2.2} />,
  shelf: <Inbox size={13} strokeWidth={2.2} />,
  music: <AudioLines size={13} strokeWidth={2.2} />,
  timer: <Timer size={13} strokeWidth={2.2} />,
  "peripheral-battery": <BatteryMedium size={13} strokeWidth={2.2} />,
  "session-count": <LayoutGrid size={13} strokeWidth={2.2} />,
};

function ItemGlyph({ id }: { id: string }) {
  if (id === "status-light") return <span className="island-bar-preview__light" />;
  if (id.startsWith("usage:")) {
    const color = USAGE_PROVIDERS.find((provider) => id === `usage:${provider.id}`)?.color ?? "var(--usage-claude)";
    return <span className="island-bar-preview__ring" style={{ "--ring": color } as CSSProperties} />;
  }
  return ICONS[id] ?? <Puzzle size={13} strokeWidth={2.2} />;
}

export function IslandBarPreview({ settings, names, placements, centers, openItem, onPick }: {
  settings: IslandSettings;
  names: ReadonlyMap<string, string>;
  placements: readonly CollapsedPlacement[];
  centers: readonly string[];
  openItem: string | null;
  onPick: (item: string) => void;
}) {
  const text = useTranslation().settings.collapsedItems;
  const shown = (zone: "left" | "right") => placements.filter((placement) => placement.zone === zone && names.has(placement.id) && !placement.hidden && !placement.shelf);
  const shelved = placements.filter((placement) => names.has(placement.id) && placement.shelf && !placement.hidden);
  const chip = (id: string, label: string, glyph: ReactNode) => (
    <button key={id} className="island-bar-preview__item" type="button" data-item={id} aria-pressed={openItem === id} aria-label={label} title={label} onClick={() => onPick(id)}>
      {glyph}
    </button>
  );
  const items = (zone: "left" | "right") => shown(zone).map(({ id }) => chip(id, names.get(id) ?? id, <ItemGlyph id={id} />));
  const centerName: Record<string, string> = { center: text.item.center, "todos-count": text.item.todoCount };
  const style = { "--bar-fill": hexToRgba(settings.islandBackgroundColor, settings.opacity / 100), "--bar-ink": settings.taskTextColor } as CSSProperties;

  return (
    <figure className="island-bar-preview" aria-label={text.previewLabel}>
      <div className="island-bar-preview__bar" style={style}>
        {items("left")}
        <span className="island-bar-preview__center">
          {centers.map((id) => chip(id, centerName[id] ?? id, id === "center" ? <Sparkles size={13} strokeWidth={2.2} /> : <span className="island-bar-preview__text">{text.place.text}</span>))}
        </span>
        {items("right")}
        {shelved.length > 0 ? (
          <button className="island-bar-preview__item island-bar-preview__more" type="button" aria-label={text.place.panel} title={text.place.panel} onClick={() => onPick(shelved[0].id)}>
            {text.more(shelved.length)}
          </button>
        ) : null}
      </div>
      <figcaption className="island-bar-preview__caption">{text.previewHint}</figcaption>
    </figure>
  );
}
