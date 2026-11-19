import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { IslandHost } from "../../plugin-kernel/islandHost";
import type { MessagePreview } from "../messagePreview";
import { heldOnHover, previewKey, remainingAtHover, type HeldPreview } from "./heldPreview.ts";

export function useHeldPreview(preview: MessagePreview | null, active: boolean, host: IslandHost) {
  const [held, setHeld] = useState<HeldPreview | null>(null);
  const hovered = useRef<number | null>(null);
  const seen = useRef<{ preview: MessagePreview; key: string; since: number } | null>(null);
  const touched = useRef<string | null>(null);
  const live = active ? preview : null;
  const liveKey = live ? previewKey(live) : null;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void host.listenHover((inside) => {
      const now = Date.now();
      hovered.current = inside ? hovered.current ?? now : null;
      setHeld((current) => heldOnHover(current, inside, now));
    }).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
      hovered.current = null;
    };
  }, [active, host]);

  useEffect(() => {
    if (!active) return;
    const touch = () => {
      touched.current = seen.current?.key ?? null;
    };
    window.addEventListener("pointerdown", touch, true);
    return () => window.removeEventListener("pointerdown", touch, true);
  }, [active]);

  useLayoutEffect(() => {
    if (live && liveKey) {
      if (seen.current?.key !== liveKey) seen.current = { preview: live, key: liveKey, since: Date.now() };
      else seen.current.preview = live;
      setHeld(null);
      return;
    }
    const last = seen.current;
    seen.current = null;
    const hoverStart = hovered.current;
    if (!active || !last || hoverStart === null || touched.current === last.key) {
      setHeld(null);
      return;
    }
    setHeld({ preview: last.preview, key: last.key, remaining: remainingAtHover(Date.now(), hoverStart, last.since), deadline: null });
  }, [live, liveKey, active]);

  const deadline = held?.deadline ?? null;
  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setTimeout(() => setHeld(null), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [deadline]);

  return live ?? (active ? held?.preview ?? null : null);
}
