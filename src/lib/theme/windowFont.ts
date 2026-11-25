import { loadSettings, SETTINGS_UPDATED_EVENT, STORAGE_KEY } from "../settings/storage";
import type { IslandSettings } from "../settings/types";
import { listenCustomFontsChanged, readCustomFontFile } from "./api";
import { customFontFaceName, fontScaleCssValue, isValidCustomFontId, uiFontStackFor } from "./fonts";

type FontSettings = Pick<IslandSettings, "fontFamily" | "fontScale" | "customFontId">;

const loadedFaces = new Map<string, FontFace>();
const loadingFaces = new Map<string, Promise<boolean>>();
const subscribers = new Set<() => void>();

function notifyFontChange() {
  for (const listener of subscribers) listener();
}

export function subscribeLoadedCustomFonts(listener: () => void) {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function getLoadedCustomFontIds(): ReadonlySet<string> {
  return new Set(loadedFaces.keys());
}

export function isCustomFontLoaded(id: string) {
  return loadedFaces.has(id);
}

export async function ensureCustomFontLoaded(id: string): Promise<boolean> {
  if (!isValidCustomFontId(id)) return false;
  if (loadedFaces.has(id)) return true;
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !("fonts" in document)) return false;
  const inflight = loadingFaces.get(id);
  if (inflight) return inflight;
  const task = (async () => {
    try {
      const buffer = await readCustomFontFile(id);
      if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) return false;
      const face = new FontFace(customFontFaceName(id), buffer);
      await face.load();
      document.fonts.add(face);
      loadedFaces.set(id, face);
      notifyFontChange();
      return true;
    } catch {
      return false;
    } finally {
      loadingFaces.delete(id);
    }
  })();
  loadingFaces.set(id, task);
  return task;
}

export function unloadCustomFont(id: string) {
  const face = loadedFaces.get(id);
  if (!face) return;
  loadedFaces.delete(id);
  if (typeof document !== "undefined" && "fonts" in document) {
    document.fonts.delete(face);
  }
  notifyFontChange();
}

export function applyWindowFont(settings: FontSettings) {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  const scale = fontScaleCssValue(settings.fontScale);
  if (scale) style.setProperty("--font-scale", scale);
  else style.removeProperty("--font-scale");

  const stack = uiFontStackFor(settings.fontFamily, settings.customFontId, loadedFaces.size > 0 ? new Set(loadedFaces.keys()) : new Set());
  if (stack) style.setProperty("--font-ui", stack);
  else style.removeProperty("--font-ui");

  if (settings.fontFamily === "custom" && isValidCustomFontId(settings.customFontId) && !loadedFaces.has(settings.customFontId)) {
    const requestedId = settings.customFontId;
    void ensureCustomFontLoaded(requestedId).then((ok) => {
      if (!ok) return;
      const latest = loadSettings();
      if (latest.fontFamily === "custom" && latest.customFontId === requestedId) {
        const nextStack = uiFontStackFor(latest.fontFamily, latest.customFontId, new Set(loadedFaces.keys()));
        if (nextStack) document.documentElement.style.setProperty("--font-ui", nextStack);
      }
    });
  }
}

let installed = false;

export function installWindowFont() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const sync = () => applyWindowFont(loadSettings());
  sync();
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) sync();
  });
  window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
  void listenCustomFontsChanged(() => {
    const current = loadSettings();
    if (current.fontFamily === "custom" && isValidCustomFontId(current.customFontId)) {
      unloadCustomFont(current.customFontId);
      void ensureCustomFontLoaded(current.customFontId).then(() => sync());
    } else {
      sync();
    }
  }).catch(() => {});
}
