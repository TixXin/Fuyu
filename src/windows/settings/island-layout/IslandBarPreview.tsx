import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { AudioLines, BatteryMedium, Camera, Download, Inbox, LayoutGrid, ListTodo, Mail, Puzzle, Sparkles, Timer } from "lucide-react";
import { USAGE_PROVIDERS } from "../../../features/claude-usage/usageRing";
import type { BarUsageWings } from "../../../features/plugin-kernel/barUsage";
import { useTranslation } from "../../../i18n";
import type { CollapsedPlacement } from "../../../lib/settings/collapsedItems";
import { useCollapsedOverflowIds } from "../../../lib/settings/useCollapsedOverflowIds";
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
  center: <Sparkles size={13} strokeWidth={2.2} />,
  "todos-count": <ListTodo size={13} strokeWidth={2.2} />,
};

export function ItemGlyph({ id }: { id: string }) {
  if (id === "status-light") return <span className="island-bar-preview__light" />;
  if (id.startsWith("usage:")) {
    const color = USAGE_PROVIDERS.find((provider) => id === `usage:${provider.id}`)?.color ?? "var(--usage-claude)";
    return <span className="island-bar-preview__ring" style={{ "--ring": color } as CSSProperties} />;
  }
  return ICONS[id] ?? <Puzzle size={13} strokeWidth={2.2} />;
}

export function IslandBarPreview({ settings, notch, wings, names, placements, centers, openItem, dragging, onPick, onDragStart }: {
  settings: IslandSettings;
  notch: boolean;
  wings: BarUsageWings | null;
  names: ReadonlyMap<string, string>;
  placements: readonly CollapsedPlacement[];
  centers: readonly string[];
  openItem: string | null;
  dragging: string | null;
  onPick: (item: string) => void;
  onDragStart: (event: PointerEvent<HTMLElement>, item: string) => void;
}) {
  const text = useTranslation().settings.collapsedItems;
  const noRoom = useCollapsedOverflowIds();
  const onBar = placements.filter((placement) => names.has(placement.id) && !placement.hidden);
  const live = notch && wings ? new Set([...wings.left, ...wings.right]) : null;
  const shown = (zone: "left" | "right") => onBar.filter((placement) => placement.zone === zone && !placement.shelf && !noRoom.has(placement.id) && (!live || live.has(placement.id)));
  const shelved = onBar.filter((placement) => placement.shelf || noRoom.has(placement.id));
  const chip = (id: string, label: string, glyph: ReactNode, movable: boolean) => (
    <button
      key={id}
      className="island-bar-preview__item"
      type="button"
      data-item={id}
      data-dragging={dragging === id || undefined}
      aria-pressed={openItem === id}
      aria-label={label}
      title={label}
      onPointerDown={movable ? (event) => onDragStart(event, id) : undefined}
      onClick={() => onPick(id)}
    >
      {glyph}
    </button>
  );
  const zone = (lane: "left" | "right") => (
    <span className="island-bar-preview__zone" data-lane={lane}>
      {shown(lane).map(({ id }) => chip(id, names.get(id) ?? id, <ItemGlyph id={id} />, true))}
    </span>
  );
  const centerName: Record<string, string> = { center: text.item.center, "todos-count": text.item.todoCount };
  const centerGlyph = (id: string) => id === "center" ? <Sparkles size={13} strokeWidth={2.2} />
    : notch ? <ListTodo size={13} strokeWidth={2.2} /> : <span className="island-bar-preview__text">{text.place.text}</span>;
  const center = (
    <span className="island-bar-preview__center" data-lane="center">
      {centers.filter((id) => !live || live.has(id === "center" ? "center" : "text")).map((id) => chip(id, centerName[id] ?? id, centerGlyph(id), false))}
    </span>
  );
  const more = shelved.length > 0 ? (
    <button className="island-bar-preview__item island-bar-preview__more" type="button" data-lane="shelf" aria-label={text.place.panel} title={text.place.panel} onClick={() => onPick(shelved[0].id)}>
      {text.more(shelved.length)}
    </button>
  ) : null;
  const centered = centers.filter((id) => !live || live.has(id === "center" ? "center" : "text")).length;
  const chipLeft = wings?.left.includes("more") ? true : wings?.right.includes("more") ? false : shown("right").length + centered >= shown("left").length;
  const moreLeft = chipLeft ? more : null;
  const style = notch
    ? undefined
    : { "--bar-fill": hexToRgba(settings.islandBackgroundColor, settings.opacity / 100), "--bar-ink": settings.taskTextColor } as CSSProperties;

  return (
    <figure className="island-bar-preview" aria-label={text.previewLabel} data-notch={notch || undefined}>
      {notch ? (
        <div className="island-bar-preview__bar" data-lane-bar="">
          <span className="island-bar-preview__wing">
            {zone("left")}
            {moreLeft}
          </span>
          <span className="island-bar-preview__notch" aria-hidden="true"><i /></span>
          <span className="island-bar-preview__wing">
            {moreLeft ? null : more}
            {center}
            {zone("right")}
          </span>
        </div>
      ) : (
        <div className="island-bar-preview__bar" style={style} data-lane-bar="">
          {zone("left")}
          {center}
          {zone("right")}
          {more}
        </div>
      )}
      <figcaption className="island-bar-preview__caption">{notch ? text.lanes.notchCaption : text.previewHint}</figcaption>
    </figure>
  );
}
