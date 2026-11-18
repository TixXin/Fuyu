import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { isSameSettings } from "./settings.ts";
import { STORAGE_KEY, loadSettings, readSettingsText } from "./storage.ts";
import type { IslandSettings } from "./types";

export type SettingsSyncControllerOptions = {
  load?: () => IslandSettings;
  readRaw?: () => string | null;
  writeRaw?: (serialized: string) => void;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (id: number) => void;
  coalesceFrames?: boolean;
};

export function createSettingsSyncController(options: SettingsSyncControllerOptions = {}) {
  const load = options.load ?? loadSettings;
  const readRaw = options.readRaw ?? readSettingsText;
  const writeRaw =
    options.writeRaw ??
    ((serialized: string) => {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    });
  const requestFrame =
    options.requestFrame ??
    ((callback: () => void) => window.requestAnimationFrame(callback));
  const cancelFrame =
    options.cancelFrame ??
    ((id: number) => window.cancelAnimationFrame(id));
  const defaultCoalesce = options.coalesceFrames === true;

  let current = load();
  let lastKnownRaw = readRaw();
  let pendingSave: IslandSettings | null = null;
  let frameId: number | null = null;
  const listeners = new Set<(next: IslandSettings) => void>();

  const notify = () => {
    for (const listener of listeners) listener(current);
  };

  const writeImmediate = (next: IslandSettings) => {
    const serialized = JSON.stringify(next);
    if (serialized === lastKnownRaw) return;
    lastKnownRaw = serialized;
    writeRaw(serialized);
  };

  const clearFrame = () => {
    if (frameId === null) return;
    cancelFrame(frameId);
    frameId = null;
  };

  const flush = () => {
    clearFrame();
    if (pendingSave === null) return;
    const target = pendingSave;
    pendingSave = null;
    writeImmediate(target);
  };

  const syncInitial = () => {
    writeImmediate(current);
  };

  const scheduleGate = () => {
    frameId = requestFrame(() => {
      frameId = null;
      if (pendingSave === null) return;
      const target = pendingSave;
      pendingSave = null;
      writeImmediate(target);
      scheduleGate();
    });
  };

  const setLocal = (
    action: SetStateAction<IslandSettings>,
    setOptions?: { coalesceFrame?: boolean },
  ) => {
    const next = typeof action === "function" ? action(current) : action;
    if (isSameSettings(current, next)) return current;
    current = next;
    const coalesce = setOptions?.coalesceFrame ?? defaultCoalesce;
    if (coalesce) {
      if (frameId === null) {
        pendingSave = null;
        writeImmediate(next);
        scheduleGate();
      } else {
        pendingSave = next;
      }
    } else {
      clearFrame();
      pendingSave = null;
      writeImmediate(next);
    }
    notify();
    return current;
  };

  const syncExternal = (event?: { key?: string | null; newValue?: string | null }) => {
    if (event && event.key !== null && event.key !== undefined && event.key !== STORAGE_KEY) {
      return current;
    }
    const rawBefore = readRaw();
    if (rawBefore === lastKnownRaw) {
      return current;
    }
    if (
      typeof event?.newValue === "string" &&
      rawBefore !== null &&
      event.newValue !== rawBefore
    ) {
      return current;
    }
    clearFrame();
    pendingSave = null;
    const next = load();
    lastKnownRaw = readRaw();
    if (!isSameSettings(current, next)) {
      current = next;
      notify();
    }
    return current;
  };

  const subscribe = (listener: (next: IslandSettings) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    get: () => current,
    syncInitial,
    setLocal,
    syncExternal,
    flush,
    subscribe,
  };
}

export function useIslandSettings(options?: { coalesceInputFrames?: boolean }) {
  const coalesceInputFrames = options?.coalesceInputFrames === true;
  const controllerRef = useRef<ReturnType<typeof createSettingsSyncController> | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createSettingsSyncController();
  }
  const controller = controllerRef.current;
  const [settings, setSettingsState] = useState<IslandSettings>(() => controller.get());
  const continuousInputRef = useRef(false);

  const setSettings: Dispatch<SetStateAction<IslandSettings>> = useCallback(
    (action) => {
      controller.setLocal(action, {
        coalesceFrame: coalesceInputFrames && continuousInputRef.current,
      });
    },
    [coalesceInputFrames, controller],
  );

  const reloadSettings = useCallback(() => {
    controller.syncExternal();
  }, [controller]);

  useEffect(() => {
    controller.syncInitial();
    const unsubscribe = controller.subscribe(setSettingsState);
    setSettingsState(controller.get());

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY) {
        controller.syncExternal(event);
      }
    };

    const onInputCapture = (event: Event) => {
      const target = event.target;
      const isContinuous =
        target instanceof HTMLInputElement &&
        (target.type === "range" || target.type === "color");
      continuousInputRef.current = isContinuous;
      if (isContinuous) {
        queueMicrotask(() => {
          continuousInputRef.current = false;
        });
      }
    };

    const flushPending = () => {
      continuousInputRef.current = false;
      controller.flush();
    };

    const onVisibilityChange = () => {
      if (document.hidden) flushPending();
    };

    window.addEventListener("storage", onStorage);
    if (coalesceInputFrames) {
      window.addEventListener("input", onInputCapture, true);
      window.addEventListener("change", flushPending);
      window.addEventListener("pointerup", flushPending, true);
      window.addEventListener("pointercancel", flushPending, true);
      window.addEventListener("pagehide", flushPending);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      flushPending();
      unsubscribe();
      window.removeEventListener("storage", onStorage);
      if (coalesceInputFrames) {
        window.removeEventListener("input", onInputCapture, true);
        window.removeEventListener("change", flushPending);
        window.removeEventListener("pointerup", flushPending, true);
        window.removeEventListener("pointercancel", flushPending, true);
        window.removeEventListener("pagehide", flushPending);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [coalesceInputFrames, controller]);

  return [settings, setSettings, reloadSettings] as const;
}
