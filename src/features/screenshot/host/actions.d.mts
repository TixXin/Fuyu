export type ScreenshotActionIcon = "inbox" | "bot" | "sparkles" | "share" | "copy" | "pin" | "wand";

export type ScreenshotActionLabel = {
  "zh-CN": string;
  en: string;
};

export type ScreenshotActionContext = {
  path: string;
  saved?: boolean;
  thumbnail?: string | null;
  text?: string | null;
};

export type ScreenshotActionResult = {
  message: string | null;
  dismiss: boolean;
};

export type ScreenshotActionSpec = {
  id: string;
  label: ScreenshotActionLabel | string;
  disabledTitle?: ScreenshotActionLabel | string;
  icon?: ScreenshotActionIcon;
  order?: number;
  disabled?: boolean | (() => boolean);
  run(context: {
    path: string;
    saved: boolean;
    thumbnail: string | null;
    text: string | null;
  }): Promise<{ message?: string; dismiss?: boolean } | string | void> | { message?: string; dismiss?: boolean } | string | void;
};

export type ScreenshotActionItem = {
  id: string;
  label: ScreenshotActionLabel;
  disabledTitle?: ScreenshotActionLabel;
  icon: ScreenshotActionIcon;
  order: number;
  disabled: boolean;
};

export type ScreenshotActionRegistry = {
  register(spec: ScreenshotActionSpec): () => void;
  has(id: unknown): boolean;
  get(id: unknown): unknown;
  list(): ScreenshotActionItem[];
  run(id: string, context: ScreenshotActionContext): Promise<ScreenshotActionResult>;
  subscribe(listener: () => void): () => void;
};

export function createScreenshotActionRegistry(): ScreenshotActionRegistry;
export const screenshotActions: ScreenshotActionRegistry;
export function registerScreenshotAction(spec: ScreenshotActionSpec): () => void;
export function subscribeScreenshotActions(listener: () => void): () => void;
