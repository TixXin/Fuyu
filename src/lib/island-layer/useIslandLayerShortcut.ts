import { useEffect } from "react";
import { setIslandLayerShortcut } from "./api";

export function useIslandLayerShortcut(shortcut: string) {
  useEffect(() => {
    setIslandLayerShortcut(shortcut || null).catch((error: unknown) => console.error("Failed to set the island layer shortcut", error));
  }, [shortcut]);
}
