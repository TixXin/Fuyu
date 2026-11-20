import { useCallback, useEffect, useState } from "react";
import type { ShortcutPanelCorner, ShortcutPanelState } from "../../features/screenshot/settings";
import { loadScreenshotSettings, saveScreenshotSettings } from "../../features/screenshot/storage";

type PanelPrefs = { state: ShortcutPanelState; corner: ShortcutPanelCorner };

function load(): PanelPrefs {
  const settings = loadScreenshotSettings();
  return { state: settings.shortcutPanel, corner: settings.shortcutCorner };
}

function save(patch: Partial<PanelPrefs>) {
  const settings = loadScreenshotSettings();
  saveScreenshotSettings({
    ...settings,
    shortcutPanel: patch.state ?? settings.shortcutPanel,
    shortcutCorner: patch.corner ?? settings.shortcutCorner,
  });
}

export function useShortcutPanel(sessionId: number | undefined, typing: boolean) {
  const [prefs, setPrefs] = useState<PanelPrefs>(load);

  useEffect(() => {
    if (sessionId !== undefined) setPrefs(load());
  }, [sessionId]);

  const toggle = useCallback(() => {
    setPrefs((current) => {
      const state = current.state === "open" ? "collapsed" : "open";
      save({ state });
      return { ...current, state };
    });
  }, []);

  const moveTo = useCallback((corner: ShortcutPanelCorner) => {
    save({ corner });
    setPrefs((current) => ({ ...current, corner }));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
      if (event.key !== "?" && event.key !== "F1") return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, typing]);

  return { ...prefs, toggle, moveTo };
}

export type ShortcutPanelControl = ReturnType<typeof useShortcutPanel>;
