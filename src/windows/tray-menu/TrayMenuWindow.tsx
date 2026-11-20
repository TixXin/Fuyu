import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { disabledBuiltinIds } from "../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { shownStatus } from "./builtinEntries";
import { getTrayMenuState, listenTrayMenuOpen, listenTrayMenuState, trayMenuAction, type TrayMenuAction, type TrayMenuState } from "./api";
import { TrayMenuCard } from "./TrayMenuCard";
import { loadTrayMenuLayout } from "./storage";
import type { TrayCardHandlers } from "./types";
import { useTrayMenuPrefs } from "./useTrayMenuPrefs";
import { useTrayMenuSize } from "./useTrayMenuSize";
import { useTrayMenuStatus } from "./useTrayMenuStatus";
import { useTrayShortcuts } from "./useTrayShortcuts";
import "./TrayMenuWindow.css";

function send(action: TrayMenuAction, arg?: string) {
  void trayMenuAction(action, arg).catch((error: unknown) => console.error(`Tray card action ${action} failed`, error));
}

export function TrayMenuWindow() {
  const light = !useSystemDark();
  useWindowAccent();
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<TrayMenuState | null>(null);
  const [opened, setOpened] = useState(0);
  const [settled, setSettled] = useState(0);
  const ready = useRef(false);
  const { layout, dnd, autostart, reload, toggleDnd, toggleAutostart } = useTrayMenuPrefs();
  const { shortcuts, refresh: refreshShortcuts } = useTrayShortcuts();
  const { status, refresh, media, join } = useTrayMenuStatus();
  const statusLayout = layout === "status";
  const plugins = useBuiltinPlugins();
  const off = useMemo(() => new Set(disabledBuiltinIds(plugins)), [plugins]);

  useEffect(() => {
    if (statusLayout) void refresh();
  }, [refresh, statusLayout]);

  useEffect(() => {
    document.documentElement.classList.toggle("island-light", light);
  }, [light]);

  const open = useCallback(async () => {
    const pending = Promise.all([
      getTrayMenuState().catch((error: unknown) => {
        console.error("Failed to read the tray card state", error);
        return null;
      }),
      reload(),
      refreshShortcuts(),
      loadTrayMenuLayout() === "status" ? refresh() : null,
    ]);
    const stale = ready.current;
    if (stale) setOpened((count) => count + 1);
    const [next] = await pending;
    if (next) {
      ready.current = true;
      setState(next);
    }
    if (stale) setSettled((count) => count + 1);
    else setOpened((count) => count + 1);
  }, [refresh, refreshShortcuts, reload]);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenTrayMenuOpen(() => void open()).then(keep);
    void listenTrayMenuState(setState).then(keep);
    void open();
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [open]);

  useTrayMenuSize(cardRef, opened, settled);

  const handlers = useMemo<TrayCardHandlers>(() => ({
    onAction: (action, arg) => {
      if (action === "toggle_island") setState((current) => current && { ...current, islandVisible: !current.islandVisible, islandBehind: false });
      if (action === "raise_island") setState((current) => current && { ...current, islandBehind: false });
      if (action === "toggle_clipboard_pause") setState((current) => current && { ...current, clipboardPaused: !current.clipboardPaused });
      send(action, arg);
    },
    onDnd: toggleDnd,
    onAutostart: () => void toggleAutostart(),
    onPlayPause: () => void media("media_play_pause"),
    onNext: () => void media("media_next"),
    onJoin: () => {
      void join();
      send("close");
    },
  }), [join, media, toggleAutostart, toggleDnd]);

  if (!state) return null;
  const live = statusLayout ? shownStatus(status, off) : { media: null, meeting: null, agents: null, now: status.now };
  return (
    <div className="tray-menu-window">
      <TrayMenuCard ref={cardRef} layout={layout} light={light} data={{ state, shortcuts, off, dnd, autostart, ...live }} handlers={handlers} />
    </div>
  );
}
