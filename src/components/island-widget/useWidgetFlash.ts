import { useCallback, useEffect, useState } from "react";

export type WidgetFlashKind = "done" | "failed";
export type WidgetFlashState = { kind: WidgetFlashKind; key: number; label: string | null } | null;
export type WidgetFlashLabels = { done?: string; failed?: (failure: unknown) => string };

const FLASH_MS = 1_100;
const FAILED_FLASH_MS = 2_400;

let flashKey = 0;

export function useWidgetFlash() {
  const [flash, setFlash] = useState<WidgetFlashState>(null);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), flash.kind === "failed" ? FAILED_FLASH_MS : FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const show = useCallback((kind: WidgetFlashKind, label: string | null = null) => {
    flashKey += 1;
    setFlash({ kind, key: flashKey, label });
  }, []);

  const track = useCallback(
    async (work: () => Promise<unknown>, labels: WidgetFlashLabels = {}) => {
      try {
        const result = await work();
        if (result === false || result === null) throw result;
        if (labels.done !== undefined) show("done", labels.done);
        return true;
      } catch (failure) {
        if (failure !== false && failure !== null) console.error("Widget action failed", failure);
        show("failed", failure !== false && failure !== null && labels.failed ? labels.failed(failure) : null);
        return false;
      }
    },
    [show],
  );

  return { flash, show, track };
}
