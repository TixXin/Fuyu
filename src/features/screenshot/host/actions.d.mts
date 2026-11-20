export type ScreenshotActionIcon = "inbox" | "bot" | "sparkles" | "share" | "copy" | "pin" | "wand" | "notebook" | "list-todo";

export type ScreenshotActionLabel = {
  "zh-CN": string;
  en: string;
};

/** Where the screenshot was taken: the app in front when it started, its window title and, for browsers, the address. Missing when Fuyu itself was in front or nothing could be read. */
export type ScreenshotSource = {
  app: string;
  title: string | null;
  url: string | null;
};

export type ScreenshotActionContext = {
  path: string;
  saved?: boolean;
  thumbnail?: string | null;
  text?: string | null;
  source?: ScreenshotSource | null;
  locale?: "zh-CN" | "en";
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
  /** Keep the picture: before `run`, the island copies the screenshot out of the history (which deletes old ones) into a folder nothing cleans, and `path` is the copy. */
  keeps?: boolean;
  run(context: {
    /** The PNG file. With `keeps`, a copy that stays after the screenshot history drops the original. */
    path: string;
    saved: boolean;
    thumbnail: string | null;
    text: string | null;
    /** Where the screenshot was taken, or `null`. */
    source: ScreenshotSource | null;
    /** The island's language, for any text the action writes or returns. */
    locale: "zh-CN" | "en";
  }): Promise<{ message?: string; dismiss?: boolean } | string | void> | { message?: string; dismiss?: boolean } | string | void;
};

export type ScreenshotActionItem = {
  id: string;
  label: ScreenshotActionLabel;
  disabledTitle?: ScreenshotActionLabel;
  icon: ScreenshotActionIcon;
  order: number;
  disabled: boolean;
  keeps: boolean;
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
