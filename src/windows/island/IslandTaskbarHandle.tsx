import { useEffect, useState, type PointerEvent } from "react";
import { useTranslation } from "../../i18n";
import { endIslandTaskbarDrag, startIslandTaskbarDrag } from "./api";
import "./IslandTaskbarHandle.css";

export type TaskbarHandleShow = "hover" | "modifier";

export function IslandTaskbarHandle({ show }: { show: TaskbarHandleShow }) {
  const t = useTranslation();
  const [modifier, setModifier] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (show !== "modifier") return;
    const track = (event: globalThis.PointerEvent) => setModifier(event.altKey);
    window.addEventListener("pointermove", track, true);
    window.addEventListener("pointerdown", track, true);
    return () => {
      window.removeEventListener("pointermove", track, true);
      window.removeEventListener("pointerdown", track, true);
    };
  }, [show]);

  const armed = show === "hover" || modifier || dragging;
  const stop = () => {
    if (!dragging) return;
    setDragging(false);
    void endIslandTaskbarDrag().catch((error: unknown) => console.error("Failed to end the taskbar drag", error));
  };

  const begin = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || !armed) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    void startIslandTaskbarDrag().catch((error: unknown) => {
      console.error("Failed to start the taskbar drag", error);
      setDragging(false);
    });
  };

  return (
    <span
      className={`island-taskbar-handle${armed ? " island-taskbar-handle--armed" : ""}${dragging ? " island-taskbar-handle--dragging" : ""}`}
      role="separator"
      aria-label={t.island.taskbarHandle}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
