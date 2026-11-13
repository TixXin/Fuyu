export type ShortcutKeys = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

const ALWAYS_BLOCKED_FUNCTION_KEYS = new Set(["F3", "F7", "BrowserBack", "BrowserForward", "BrowserRefresh", "BrowserSearch", "BrowserHome"]);
const PRIMARY_BLOCKED = new Set(["p", "f", "g", "s", "u", "n", "o", "h", "j", "d", "=", "+", "-", "_", "0", "[", "]"]);
const DEV_ONLY_KEYS = new Set(["r"]);

export function blockedShortcut(event: ShortcutKeys, options: { mac: boolean; dev: boolean }): boolean {
  if (ALWAYS_BLOCKED_FUNCTION_KEYS.has(event.key)) return true;
  if (event.key === "F5") return !options.dev;
  if (event.key === "F12") return !options.dev;
  if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return true;
  const primary = options.mac ? event.metaKey : event.ctrlKey;
  if (!primary) return false;
  const key = event.key.toLowerCase();
  if (DEV_ONLY_KEYS.has(key)) return !options.dev;
  if (event.shiftKey && (key === "i" || key === "j" || key === "c")) return !options.dev;
  if (options.mac && event.altKey && key === "i") return !options.dev;
  return PRIMARY_BLOCKED.has(key);
}

export function keepsNativeMenu(target: EventTarget | null, selection: Selection | null): boolean {
  if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return true;
  if (!selection || selection.isCollapsed || !(target instanceof Node)) return false;
  for (let index = 0; index < selection.rangeCount; index += 1) {
    if (selection.getRangeAt(index).intersectsNode(target)) return true;
  }
  return false;
}

export function blockBrowserDefaults(options: { mac: boolean; dev: boolean }) {
  window.addEventListener("contextmenu", (event) => {
    if (event.defaultPrevented || (options.dev && event.altKey)) return;
    if (!keepsNativeMenu(event.target, window.getSelection())) event.preventDefault();
  });
  window.addEventListener(
    "keydown",
    (event) => {
      if (blockedShortcut(event, options)) event.preventDefault();
    },
    true,
  );
  window.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) event.preventDefault();
    },
    { passive: false, capture: true },
  );
  window.addEventListener(
    "dragstart",
    (event) => {
      if (!(event.target instanceof Element && event.target.closest("[draggable='true'], input, textarea, [contenteditable='true']"))) event.preventDefault();
    },
    true,
  );
  window.addEventListener(
    "auxclick",
    (event) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) event.preventDefault();
    },
    true,
  );
  window.addEventListener(
    "click",
    (event) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && (event.shiftKey || event.ctrlKey || event.metaKey)) event.preventDefault();
    },
    true,
  );
}
