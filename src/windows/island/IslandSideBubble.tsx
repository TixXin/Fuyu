import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { CollapsedMessageContent } from "../../features/messages/CollapsedMessageContent";
import type { MessagePreview } from "../../features/messages/messagePreview";
import { setIslandSideBubbleRect } from "./api";

type IslandSideBubbleProps = {
  top: number;
  preview: MessagePreview | null;
  alert: ReactNode;
  onOpenPreview: () => void;
};

export function IslandSideBubble({ top, preview, alert, onOpenPreview }: IslandSideBubbleProps) {
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
      role={preview ? "button" : "status"}
      tabIndex={preview ? 0 : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (preview) onOpenPreview();
      }}
    >
      <span className="island-side-bubble__content">
        <CollapsedMessageContent preview={preview} enabled>
          {alert}
        </CollapsedMessageContent>
      </span>
    </div>
  );
}
