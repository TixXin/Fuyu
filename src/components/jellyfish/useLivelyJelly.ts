import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { JELLY_LOOK_REST, JELLY_POKE_MS, lookToward, pokedMood, type JellyLook } from "./jellyLively.ts";
import type { PixelMood } from "./pixel/pixelPoses.ts";

export type LivelyJelly = { mood: PixelMood; look: JellyLook; wrap: RefObject<HTMLSpanElement | null>; onPoke: ((event: MouseEvent) => void) | undefined };

export function useLivelyJelly(enabled: boolean, mood: PixelMood): LivelyJelly {
  const wrap = useRef<HTMLSpanElement>(null);
  const still = useReducedMotion();
  const [poked, setPoked] = useState<PixelMood | null>(null);
  const [look, setLook] = useState<JellyLook>(JELLY_LOOK_REST);
  const reaction = enabled && !still ? pokedMood(mood) : null;
  const shown = poked && reaction ? poked : mood;
  const gazing = enabled && !still && shown === "idle";

  useEffect(() => {
    if (!poked) return undefined;
    const timer = window.setTimeout(() => setPoked(null), JELLY_POKE_MS);
    return () => window.clearTimeout(timer);
  }, [poked]);

  useEffect(() => {
    if (!gazing) return undefined;
    const follow = (event: PointerEvent) => {
      const box = wrap.current?.getBoundingClientRect();
      if (!box || !box.width) return;
      const next = lookToward(event.clientX - (box.left + box.width / 2), event.clientY - (box.top + box.height / 2), box.width, box.height);
      setLook((current) => (current.x === next.x && current.y === next.y ? current : next));
    };
    const rest = () => setLook(JELLY_LOOK_REST);
    window.addEventListener("pointermove", follow);
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      window.removeEventListener("pointermove", follow);
      document.documentElement.removeEventListener("pointerleave", rest);
    };
  }, [gazing]);

  const onPoke = reaction
    ? (event: MouseEvent) => {
        event.stopPropagation();
        setPoked(reaction);
      }
    : undefined;
  return { mood: shown, look: gazing ? look : JELLY_LOOK_REST, wrap, onPoke };
}
