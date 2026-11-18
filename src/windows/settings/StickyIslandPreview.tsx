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
        if (entry) setStuck(!entry.isIntersecting);
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

  return (
    <>
      <div ref={sentinelRef} className="sticky-island-preview__sentinel">
        <IslandPreview settings={settings} />
      </div>
      {stuck ? (
        <div className="sticky-island-preview__bar" data-search="off">
          <IslandPreview settings={settings} compact />
        </div>
      ) : null}
    </>
  );
}
