import { useEffect, useState, type CSSProperties } from "react";
import { isWideText, parsePageIcon } from "../../lib/settings/pageIconValue";
import { usePageIconImage } from "../../lib/settings/usePageIconImages";
import type { PanelIconComponent } from "../island-widget/panelIcons";
import { loadLucideCatalog, lucideCatalogNow } from "./lucideCatalog";
import "./CustomPageIcon.css";

export type PageIconProps = { size?: number | string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean; className?: string };

type CustomPageIconProps = PageIconProps & { value: string; fallback?: PanelIconComponent };

const toPx = (size: number | string | undefined) => (typeof size === "number" ? size : Number.parseFloat(size ?? "") || 16);
const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

function LazyLucide({ name, fallback: Fallback, size, ...props }: PageIconProps & { name: string; fallback?: PanelIconComponent }) {
  const [catalog, setCatalog] = useState(lucideCatalogNow);
  useEffect(() => {
    if (catalog) return;
    let live = true;
    loadLucideCatalog().then((loaded) => live && setCatalog(loaded)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [catalog]);
  const Icon = catalog?.icon(name);
  if (Icon) return <Icon size={size} {...props} aria-hidden="true" />;
  if (catalog && Fallback) return <Fallback size={size} {...props} />;
  const px = toPx(size);
  return <span className={classes("page-glyph", props.className)} style={{ width: px, height: px }} aria-hidden="true" />;
}

function ImageGlyph({ id, px, className, fallback: Fallback }: { id: string; px: number; className?: string; fallback?: PanelIconComponent }) {
  const image = usePageIconImage(id);
  if (!image) return Fallback ? <Fallback size={px} className={className} /> : null;
  if (!image.mono) return <img className={classes("page-glyph page-glyph--image", className)} src={image.data} width={px} height={px} alt="" draggable={false} />;
  const mask: CSSProperties = { width: px, height: px, WebkitMaskImage: `url(${image.data})`, maskImage: `url(${image.data})` };
  return <span className={classes("page-glyph page-glyph--mask", className)} style={mask} aria-hidden="true" />;
}

export function CustomPageIcon({ value, fallback: Fallback, size, strokeWidth, absoluteStrokeWidth, className }: CustomPageIconProps) {
  const parsed = parsePageIcon(value);
  const px = toPx(size);
  if (!parsed) return Fallback ? <Fallback size={size} strokeWidth={strokeWidth} absoluteStrokeWidth={absoluteStrokeWidth} className={className} /> : null;
  switch (parsed.kind) {
    case "name":
      return <LazyLucide name={parsed.name} fallback={Fallback} size={size} strokeWidth={strokeWidth} absoluteStrokeWidth={absoluteStrokeWidth} className={className} />;
    case "emoji":
      return (
        <span className={classes("page-glyph page-glyph--emoji", parsed.mono && "page-glyph--mono", className)} style={{ fontSize: Math.round(px * 1.05) }} aria-hidden="true">
          {parsed.emoji}
        </span>
      );
    case "text":
      return (
        <span
          className={classes("panel-text-icon page-glyph--text", !parsed.bold && "page-glyph--light", className)}
          style={{ fontSize: Math.round(px * (isWideText(parsed.text) ? 0.86 : 0.8)) }}
          aria-hidden="true"
        >
          {parsed.text}
        </span>
      );
    case "image":
      return <ImageGlyph id={parsed.id} px={px} className={className} fallback={Fallback} />;
  }
}
