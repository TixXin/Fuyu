export { SERVICE_NAME } from "@fuyu/plugin-manifest/names";

export const HOST_PROTOCOL = 2;
export const WINDOW_PROTOCOL = 1;

export const CLOSE = {
  stopping: 4000,
  badToken: 4401,
  badOrigin: 4403,
  noHello: 4408,
  badProtocol: 4426,
};

export const SERVICE_CALLS = ["service.call", "service.on", "service.off"];


export const SERVICE_TIMEOUT_MS = 30_000;

export const WINDOW_ORIGINS = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];

export const SLOT_THEME = [
  "--fuyu-plugin-text",
  "--fuyu-plugin-text-secondary",
  "--fuyu-plugin-text-muted",
  "--fuyu-plugin-surface",
  "--fuyu-plugin-surface-hover",
  "--fuyu-plugin-border",
  "--fuyu-plugin-accent",
  "--fuyu-plugin-on-accent",
  "--fuyu-plugin-warning",
  "--fuyu-plugin-danger",
  "--fuyu-plugin-font",
  "--fuyu-plugin-radius",
];

export const SHARED_MODULES = {
  react: "__shared/react.js",
  "react/jsx-runtime": "__shared/react-jsx-runtime.js",
};

export const HOST_SHARED_MODULES = ["@fuyu/plugin-base", "fuyu-plugin", "@fuyu/plugin-base/services"];

export const SLOTS = {
  "island.page/v1": { kind: "list", perPlugin: 2, meta: ["title", "icon", "shortcutOrder", "headerDot", "enabled", "fallback", "fold"] },
  "island.header/v1": { kind: "list", perPlugin: 1, meta: ["enabled"] },
  "island.collapsed/v1": { kind: "list", perPlugin: 2, meta: ["group", "width", "hideable", "shown", "opens"] },
  "island.collapsed-center/v1": { kind: "single", perPlugin: 1, meta: ["width", "shown"] },
  "island.alert/v1": { kind: "list", perPlugin: 1, meta: ["trailing", "popup"] },
  "island.notice/v1": { kind: "list", perPlugin: 1, meta: ["active", "actions"] },
  "island.line/v1": { kind: "list", perPlugin: 2, meta: [] },
  "island.side/v1": { kind: "list", perPlugin: 2, meta: [] },
  "island.overlay/v1": { kind: "list", perPlugin: 1, meta: [] },
  "island.runner/v1": { kind: "list", perPlugin: 1, meta: [] },
  "island.dev/v1": { kind: "list", max: 3, perPlugin: 1, meta: [] },
  "settings.category/v1": { kind: "list", perPlugin: 2, meta: ["group", "icon", "tabs", "available", "feature", "aliases"] },
  "settings.section/v1": { kind: "list", perPlugin: 4, groupBy: "category", meta: ["category"] },
  "settings.runner/v1": { kind: "list", perPlugin: 1, meta: [] },
  "plugin-window.view/v1": { kind: "list", perPlugin: 8, meta: ["windowId", "title"], experimental: true },
};
