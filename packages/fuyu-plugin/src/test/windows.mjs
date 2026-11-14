import { HOST_ERROR, METHOD_NOT_FOUND, RpcError } from "./methods.mjs";

export const EXPERIMENTAL_APIS = ["windows"];
const OPEN_WINDOW_MS = 15_000;
const PER_PLUGIN = 8;
const MIN_SIDE = 48;
const SCREEN = { id: "\\\\.\\DISPLAY1", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1032 }, scale: 1, primary: true };
const OPTION_NAMES = ["layer", "opacity", "title", "resizable", "minSize", "maxSize", "clickThrough", "hideOnBlur"];

function fail(status, message) {
  throw new RpcError(HOST_ERROR, message, status);
}

function windowId(params) {
  const id = params?.id;
  if (typeof id !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(id)) fail(400, "\"id\" must be 1-64 letters, digits, '-', '_' or '.'.");
  return id;
}

function existing(host, params) {
  const id = windowId(params);
  return host.windows.get(id) ?? fail(404, `The plugin has no window "${id}".`);
}

function recentlyUsed(host) {
  return host.lastUserAction !== null && Date.now() - host.lastUserAction <= OPEN_WINDOW_MS;
}

function requireRecentUse(host, what) {
  if (!recentlyUsed(host)) fail(403, `A panel can ${what} only within 15 s of the user using the plugin (its shortcut, a command, a message button or one of its windows).`);
}

function applyOptions(window, params) {
  if (params.layer !== undefined && !["desktop", "normal", "topmost"].includes(params.layer)) fail(400, "\"layer\" must be \"desktop\", \"normal\" or \"topmost\".");
  if (params.opacity !== undefined && !(typeof params.opacity === "number" && params.opacity >= 0.2 && params.opacity <= 1)) fail(400, "\"opacity\" must be between 0.2 and 1.");
  if (params.hideOnBlur === true && window.kind === "widget") fail(400, "\"hideOnBlur\" is only for panels: widgets never take the focus.");
  for (const name of OPTION_NAMES) if (params[name] !== undefined) window[name] = structuredClone(params[name]);
  if (params.bounds) {
    const { x, y, width, height } = params.bounds;
    window.bounds = { x, y, width: Math.max(MIN_SIDE, Math.min(width, SCREEN.workArea.width)), height: Math.max(MIN_SIDE, Math.min(height, SCREEN.workArea.height)) };
  }
}

function describe(window) {
  const { messages, ...rest } = window;
  return structuredClone(rest);
}

function create(host, params) {
  const id = windowId(params);
  if (!["panel", "widget"].includes(params?.kind)) fail(400, "\"kind\" must be \"panel\" or \"widget\".");
  const entry = params?.entry;
  if (typeof entry !== "string" || !/\.html?$/i.test(entry) || entry.startsWith("/") || entry.split("/").some((part) => part === "" || part === "." || part === "..")) {
    fail(400, "\"entry\" must be a relative path to an .html file in the plugin folder.");
  }
  if (host.windows.has(id)) fail(409, `The plugin already has a window "${id}"; use window.update or close it first.`);
  if (host.windows.size >= PER_PLUGIN) fail(429, `A plugin can have at most ${PER_PLUGIN} windows at once.`);
  const visible = params.visible ?? true;
  if (params.kind === "panel" && visible) requireRecentUse(host, "show");
  const panel = params.kind === "panel";
  const size = panel ? { width: 640, height: 420 } : { width: 240, height: 160 };
  const window = {
    id,
    kind: params.kind,
    entry,
    visible,
    focused: panel && visible,
    bounds: { x: (SCREEN.workArea.width - size.width) / 2, y: (SCREEN.workArea.height - size.height) / 2, ...size },
    screen: SCREEN.id,
    layer: panel ? "topmost" : "desktop",
    opacity: 1,
    clickThrough: false,
    resizable: false,
    hideOnBlur: false,
    title: null,
    messages: [],
  };
  applyOptions(window, params);
  host.windows.set(id, window);
  return describe(window);
}

export function windowMethod(host, method, params) {
  if (!(host.manifest.experimentalApis ?? []).includes("windows")) {
    throw new RpcError(METHOD_NOT_FOUND, `"${method}" is experimental: list "windows" in experimentalApis and load the plugin in development mode (Windows only for now).`);
  }
  switch (method) {
    case "screens.list":
      return { screens: [structuredClone(SCREEN)] };
    case "window.list":
      return { windows: [...host.windows.values()].map(describe) };
    case "window.create":
      return create(host, params);
    case "window.update": {
      const window = existing(host, params);
      for (const fixed of ["kind", "entry"]) if (params[fixed] !== undefined) fail(400, `"${fixed}" cannot change after window.create; close the window and create it again.`);
      applyOptions(window, params);
      return describe(window);
    }
    case "window.show":
    case "window.focus": {
      const window = existing(host, params);
      const focus = method === "window.focus";
      if (focus && window.kind === "widget") fail(400, "Widgets never take the keyboard focus.");
      if (window.kind === "panel") requireRecentUse(host, focus ? "take the focus" : "show");
      window.visible = true;
      window.focused = window.kind === "panel";
      return { visible: true, focused: window.focused };
    }
    case "window.hide": {
      const window = existing(host, params);
      window.visible = false;
      window.focused = false;
      return {};
    }
    case "window.close":
      existing(host, params);
      host.windows.delete(params.id);
      return {};
    case "window.postMessage": {
      const window = existing(host, params);
      window.messages.push(structuredClone(params.message ?? null));
      return { delivered: true };
    }
    default:
      throw new RpcError(METHOD_NOT_FOUND, `Unknown method "${method}".`);
  }
}
