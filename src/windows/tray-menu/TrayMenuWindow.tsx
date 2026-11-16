import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
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
  const { layout, dnd, autostart, reload, toggleDnd, toggleAutostart } = useTrayMenuPrefs();
  const { shortcuts, refresh: refreshShortcuts } = useTrayShortcuts();
  const { status, refresh, media, join } = useTrayMenuStatus();
  const statusLayout = layout === "status";

  useEffect(() => {
    if (statusLayout) void refresh();
  }, [refresh, statusLayout]);

  useEffect(() => {
    document.documentElement.classList.toggle("island-light", light);
  }, [light]);

  const open = useCallback(async () => {
    const [next] = await Promise.all([
      getTrayMenuState().catch((error: unknown) => {
        console.error("Failed to read the tray card state", error);
        return null;
      }),
      reload(),
      refreshShortcuts(),
      loadTrayMenuLayout() === "status" ? refresh() : null,
    ]);
    if (next) setState(next);
    setOpened((count) => count + 1);
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

  useTrayMenuSize(cardRef, opened);

  const handlers = useMemo<TrayCardHandlers>(() => ({
    onAction: (action, arg) => {
      if (action === "toggle_island" || action === "toggle_clipboard_pause") {
        setState((current) => current && (action === "toggle_island"
          ? { ...current, islandVisible: !current.islandVisible }
          : { ...current, clipboardPaused: !current.clipboardPaused }));
      }
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
  const live = statusLayout ? status : { media: null, meeting: null, agents: null, now: status.now };
  return (
    <div className="tray-menu-window">
      <TrayMenuCard ref={cardRef} layout={layout} light={light} data={{ state, shortcuts, dnd, autostart, ...live }} handlers={handlers} />
    </div>
  );
}
