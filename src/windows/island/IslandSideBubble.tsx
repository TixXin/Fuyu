import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { setIslandSideBubbleRect } from "./api";
import { IslandSummary } from "./IslandSummary";

type IslandSideBubbleProps = {
  top: number;
  summary: string | null;
  previewing: boolean;
  alert: ReactNode;
  onOpenPreview: () => void;
};

export function IslandSideBubble({ top, summary, previewing, alert, onOpenPreview }: IslandSideBubbleProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !isTauri()) return;
    const send = () => {
      const rect = element.getBoundingClientRect();
      void setIslandSideBubbleRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }).catch(() => undefined);
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(element);
    return () => {
      observer.disconnect();
      void setIslandSideBubbleRect(null).catch(() => undefined);
    };
  }, [top]);

  return (
    <div
      ref={ref}
      className="island-side-bubble"
      style={{ "--island-side-bubble-top": `${top}px` } as CSSProperties}
      role={previewing ? "button" : "status"}
      tabIndex={previewing ? 0 : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (previewing) onOpenPreview();
      }}
    >
      <span className="island-side-bubble__content">
        <IslandSummary item={summary} enabled>
          {alert}
        </IslandSummary>
      </span>
    </div>
  );
}
