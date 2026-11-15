import { useEffect, useRef, type CSSProperties } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { QuotaAlert } from "../../features/agent-status/quotaAlerts";
import { QuotaAlertPopup } from "../../features/agent-status/QuotaAlertPopup";
import type { DeviceAlert } from "../../features/device-events/api";
import { DeviceAlertPopup } from "../../features/device-events/DeviceAlertPopup";
import { CollapsedMessageContent } from "../../features/messages/CollapsedMessageContent";
import type { MessagePreview } from "../../features/messages/messagePreview";
import type { LevelChange } from "../../features/system-levels/api";
import { LevelPopup } from "../../features/system-levels/LevelPopup";
import { setIslandSideBubbleRect } from "./api";

type IslandSideBubbleProps = {
  top: number;
  preview: MessagePreview | null;
  deviceAlert: DeviceAlert | null;
  quotaAlert: QuotaAlert | null;
  levelPopup: LevelChange | null;
  onOpenPreview: () => void;
};

export function sideBubbleShown({ preview, deviceAlert, quotaAlert, levelPopup }: Pick<IslandSideBubbleProps, "preview" | "deviceAlert" | "quotaAlert" | "levelPopup">) {
  return Boolean(preview || deviceAlert || quotaAlert || levelPopup);
}

export function IslandSideBubble({ top, preview, deviceAlert, quotaAlert, levelPopup, onOpenPreview }: IslandSideBubbleProps) {
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
          {deviceAlert ? <DeviceAlertPopup alert={deviceAlert} /> : quotaAlert ? <QuotaAlertPopup alert={quotaAlert} /> : levelPopup ? <LevelPopup change={levelPopup} /> : null}
        </CollapsedMessageContent>
      </span>
    </div>
  );
}
