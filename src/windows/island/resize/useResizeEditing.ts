import { isTauri } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import { useEffect, useRef, type RefObject } from "react";
import { useTranslation } from "../../../i18n";
import { setIslandOverflowRect, takeIslandClickFocus } from "../api";
import { setResizeEditing, useResizeState } from "./session.ts";
import type { IslandResizeModel } from "./useIslandResize";

const STEP = 10;
const BIG_STEP = 40;
const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function useResizeEditing(
  rootRef: RefObject<HTMLDivElement | null>,
  chipsRef: RefObject<HTMLDivElement | null>,
  model: IslandResizeModel,
  expanded: boolean,
  enabled: boolean,
) {
  const t = useTranslation();
  const { editing } = useResizeState();
  const savedRef = useRef<ReturnType<IslandResizeModel["snapshot"]> | null>(null);
  const latest = useRef(model);
  useEffect(() => {
    latest.current = model;
  });

  useEffect(() => {
    if (!enabled) setResizeEditing(false);
  }, [enabled]);

  useEffect(() => () => setResizeEditing(false), [expanded]);

  useEffect(() => {
    if (!editing) {
      savedRef.current = null;
      return;
    }
    savedRef.current = latest.current.snapshot();
    void takeIslandClickFocus().catch(() => undefined);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        if (event.key === "Escape" && savedRef.current) latest.current.restore(savedRef.current);
        setResizeEditing(false);
      } else if (KEYS[event.key]) {
        const [x, y] = KEYS[event.key];
        const step = event.shiftKey ? BIG_STEP : STEP;
        latest.current.nudge(!expanded, x * step, y * step);
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const host = rootRef.current?.parentElement;
    const press = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".island-resize__bead, .island-resize__chips")) return;
      setResizeEditing(false);
    };
    window.addEventListener("keydown", key, true);
    host?.addEventListener("pointerdown", press, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      host?.removeEventListener("pointerdown", press, true);
    };
  }, [editing, expanded, rootRef]);

  useEffect(() => {
    const chips = chipsRef.current;
    if (!editing || expanded || !chips) return;
    const rect = chips.getBoundingClientRect();
    void setIslandOverflowRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }).catch(() => undefined);
    return () => {
      void setIslandOverflowRect(null).catch(() => undefined);
    };
  }, [chipsRef, editing, expanded]);

  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host || !enabled || !expanded) return;
    const open = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!isTauri() || event.defaultPrevented || !target?.closest(".island__header")) return;
      event.preventDefault();
      void Menu.new({
        items: [
          { id: "island-resize", text: t.island.resize.menu, action: () => setResizeEditing(true) },
          { id: "island-resize-reset", text: t.island.resize.reset, action: () => latest.current.applyPreset("default") },
        ],
      })
        .then((menu) => menu.popup())
        .catch((error: unknown) => console.error("Failed to open the resize menu", error));
    };
    host.addEventListener("contextmenu", open);
    return () => host.removeEventListener("contextmenu", open);
  }, [enabled, expanded, rootRef, t]);

  return editing;
}
