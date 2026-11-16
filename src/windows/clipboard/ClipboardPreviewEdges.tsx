import { useRef, type PointerEvent } from "react";
import { resizeClipboardPreview } from "../../features/clipboard/api";
import type { ClipboardPreviewDragPhase, ClipboardPreviewEdge } from "../../features/clipboard/previewCommands";

const EDGES: readonly ClipboardPreviewEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

type Drag = { edge: ClipboardPreviewEdge; x: number; y: number; dx: number; dy: number; queued: boolean; chain: Promise<void> };

const reportError = (error: unknown) => console.error("Failed to resize the clipboard preview", error);

export function ClipboardPreviewEdges() {
  const drag = useRef<Drag | null>(null);

  const send = (current: Drag, phase: ClipboardPreviewDragPhase) => {
    current.chain = current.chain.then(() => resizeClipboardPreview(current.edge, current.dx, current.dy, phase)).catch(reportError);
  };

  const down = (edge: ClipboardPreviewEdge) => (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const current: Drag = { edge, x: event.screenX, y: event.screenY, dx: 0, dy: 0, queued: false, chain: Promise.resolve() };
    drag.current = current;
    send(current, "start");
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    current.dx = event.screenX - current.x;
    current.dy = event.screenY - current.y;
    if (current.queued) return;
    current.queued = true;
    current.chain = current.chain.then(() => {
      current.queued = false;
      return resizeClipboardPreview(current.edge, current.dx, current.dy, "move");
    }).catch(reportError);
  };

  const up = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    current.dx = event.screenX - current.x;
    current.dy = event.screenY - current.y;
    send(current, "end");
  };

  return (
    <>
      {EDGES.map((edge) => (
        <div
          key={edge}
          className={`clipboard-preview__edge clipboard-preview__edge--${edge}`}
          aria-hidden="true"
          data-edge={edge}
          onPointerDown={down(edge)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      ))}
    </>
  );
}
