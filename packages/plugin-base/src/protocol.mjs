export const HOST_PROTOCOL = 2;
export const WINDOW_PROTOCOL = 1;

export const CLOSE = {
  stopping: 4000,
  badToken: 4401,
  badOrigin: 4403,
  noHello: 4408,
  badProtocol: 4426,
};

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
  "--fuyu-plugin-font",
  "--fuyu-plugin-radius",
];

export const SHARED_MODULES = {
  react: "__shared/react.js",
  "react/jsx-runtime": "__shared/react-jsx-runtime.js",
};
