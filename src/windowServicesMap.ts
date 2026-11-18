const ALL_SERVICE_FEATURES = [
  "agent-status",
  "calendar",
  "cc-connect",
  "clipboard",
  "file-shelf",
  "media",
  "messages",
  "timer",
  "todos",
  "translation",
] as const;

export type ServiceFeature = (typeof ALL_SERVICE_FEATURES)[number];

const SETTINGS_SERVICE_FEATURES: readonly ServiceFeature[] = [
  "agent-status",
  "calendar",
  "cc-connect",
  "clipboard",
  "file-shelf",
  "media",
  "translation",
];

const SCREENSHOT_SERVICE_FEATURES: readonly ServiceFeature[] = [
  "agent-status",
  "file-shelf",
  "translation",
];

const CLIPBOARD_SERVICE_FEATURES: readonly ServiceFeature[] = [
  "clipboard",
  "translation",
];

const TRANSLATION_SERVICE_FEATURES: readonly ServiceFeature[] = [
  "translation",
];

const NO_SERVICE_FEATURES: readonly ServiceFeature[] = [];

export function serviceFeaturesForWindow(windowKind: string | null): readonly ServiceFeature[] {
  switch (windowKind) {
    case null:
      return ALL_SERVICE_FEATURES;
    case "settings":
      return SETTINGS_SERVICE_FEATURES;
    case "screenshot":
      return SCREENSHOT_SERVICE_FEATURES;
    case "clipboard":
      return CLIPBOARD_SERVICE_FEATURES;
    case "translation":
      return TRANSLATION_SERVICE_FEATURES;
    case "pin":
    case "drag-grid":
    case "clipboard-preview":
    case "tray-menu":
    case "onboarding":
    default:
      return NO_SERVICE_FEATURES;
  }
}
