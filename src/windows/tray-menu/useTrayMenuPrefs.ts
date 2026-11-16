import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEY, loadSettings, saveSettings } from "../../lib/settings/storage";
import { readLaunchAtStartup, saveLaunchAtStartup } from "../settings/api";
import { TRAY_MENU_LAYOUT_KEY, loadTrayMenuLayout } from "./storage";

export function useTrayMenuPrefs() {
  const [layout, setLayout] = useState(loadTrayMenuLayout);
  const [dnd, setDnd] = useState(() => loadSettings().gameDoNotDisturb);
  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === TRAY_MENU_LAYOUT_KEY || event.key === null) setLayout(loadTrayMenuLayout());
      if (event.key === STORAGE_KEY || event.key === null) setDnd(loadSettings().gameDoNotDisturb);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const reload = useCallback(async () => {
    setLayout(loadTrayMenuLayout());
    setDnd(loadSettings().gameDoNotDisturb);
    try {
      setAutostart(await readLaunchAtStartup());
    } catch (error) {
      console.error("Failed to read launch at startup for the tray card", error);
    }
  }, []);

  const toggleDnd = useCallback(() => {
    const settings = loadSettings();
    const next = !settings.gameDoNotDisturb;
    saveSettings({ ...settings, gameDoNotDisturb: next });
    setDnd(next);
  }, []);

  const toggleAutostart = useCallback(async () => {
    const next = !autostart;
    setAutostart(next);
    try {
      await saveLaunchAtStartup(next);
    } catch (error) {
      console.error("Failed to change launch at startup from the tray card", error);
      setAutostart(!next);
    }
  }, [autostart]);

  return { layout, dnd, autostart, reload, toggleDnd, toggleAutostart };
}
