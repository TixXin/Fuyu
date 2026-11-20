import type { ServiceDefinition } from "../define.mjs";

export type ScreenshotActionIconName = "inbox" | "bot" | "sparkles" | "share" | "copy" | "pin" | "wand" | "notebook" | "list-todo";

export type ScreenshotActionLabelText = { "zh-CN": string; en: string };

/** Where the screenshot was taken: the app in front when it started, its window title and, for browsers, the address. */
export type ScreenshotActionSource = { app: string; title: string | null; url: string | null };

export type ScreenshotActionEntry = {
  id: string;
  label: ScreenshotActionLabelText;
  disabledTitle?: ScreenshotActionLabelText;
  icon: ScreenshotActionIconName;
  order: number;
  disabled: boolean;
  /** The action keeps the picture: the island copies it out of the screenshot history first and hands the copy's path to `run`. */
  keeps: boolean;
};

export type ScreenshotActionRunContext = {
  path: string;
  saved?: boolean;
  thumbnail?: string | null;
  text?: string | null;
  source?: ScreenshotActionSource | null;
  locale?: "zh-CN" | "en";
};

export type ScreenshotActionsMethods = {
  list(): { actions: ScreenshotActionEntry[] };
  run(params: { id: string; context: ScreenshotActionRunContext }): { message: string | null; dismiss: boolean };
};

export type ScreenshotActionsEvents = { changed: { actions: ScreenshotActionEntry[] } };

export type ScreenshotActionsErrorCode = "bad-params" | "not-found" | "disabled" | "conflict";

export const screenshotActionsV1: ServiceDefinition<ScreenshotActionsMethods, ScreenshotActionsEvents, {}>;
