import { useEffect } from "react";
import { setIslandExpandShortcut } from "./api";

export function useIslandExpandShortcut(shortcut: string) {
  useEffect(() => {
    setIslandExpandShortcut(shortcut || null).catch((error: unknown) => console.error("Failed to set the island expand shortcut", error));
  }, [shortcut]);
}
