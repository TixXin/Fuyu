import "./ArrivalTrackArt.css";

export function ArrivalTrackArt({ cover, sourceIcon, size }: { cover: string | null; sourceIcon: string | null; size: number }) {
  const main = cover ?? sourceIcon;
  if (!main) return null;
  const badge = cover && sourceIcon && size >= 28 ? sourceIcon : null;
  return (
    <span className={`message-arrivals__art${cover ? " message-arrivals__art--cover" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <img className="message-arrivals__art-main" src={main} alt="" width={size} height={size} draggable={false} />
      {badge && <img className="message-arrivals__art-badge" src={badge} alt="" width={14} height={14} draggable={false} />}
    </span>
  );
}
