import { useEffect, useRef, useState } from "react";
import { IslandPreview } from "../../components/island-preview/IslandPreview";
import type { IslandSettings } from "../../lib/settings/types";
import "./StickyIslandPreview.css";

export function StickyIslandPreview({
  settings,
  compact = false,
}: {
  settings: IslandSettings;
  compact?: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [sentinelHeight, setSentinelHeight] = useState(0);

  useEffect(() => {
    if (compact) {
      setStuck(false);
      return;
    }
    const element = sentinelRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const root = element.closest(".editor-panel");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const nextStuck = !entry.isIntersecting;
        if (nextStuck) {
          const measured = element.offsetHeight || Math.round(entry.boundingClientRect.height);
          if (measured > 0) setSentinelHeight(measured);
        }
        setStuck(nextStuck);
      },
      { root, threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact]);

  if (compact) {
    return (
      <div className="sticky-island-preview sticky-island-preview--compact">
        <IslandPreview settings={settings} compact />
      </div>
    );
  }

  const collapseSentinel = stuck && sentinelHeight > 0;

  return (
    <>
      <div
        ref={sentinelRef}
        className="sticky-island-preview__sentinel"
        style={collapseSentinel ? { height: `${sentinelHeight}px` } : undefined}
      >
        {collapseSentinel ? null : <IslandPreview settings={settings} />}
      </div>
      {stuck ? (
        <div className="sticky-island-preview__bar" data-search="off">
          <IslandPreview settings={settings} compact />
        </div>
      ) : null}
    </>
  );
}
