import type { Issue } from "./index.mjs";

export type PreviewTheme = "dark" | "light";
export type PreviewLocale = "zh-CN" | "en";

export interface PreviewOptions {
  /** Where to write the page; `build/preview.html` in the plugin by default. */
  out?: string;
  /** Draw only this theme; both by default. */
  theme?: PreviewTheme;
  /** Draw only this language; both by default. */
  locale?: PreviewLocale;
  /** Also save each view as `<page name>-<theme>-<locale>.png`. Needs Chrome, Edge or Chromium on this machine. */
  png?: boolean;
  /** Open the page in the default browser. */
  open?: boolean;
  /** Show the official mark. Defaults to whether the package name is in the @fuyu scope. */
  official?: boolean;
  env?: Record<string, string | undefined>;
  appKey?: string;
}

export interface PreviewResult {
  dir: string;
  file: string;
  stages: { theme: PreviewTheme; locale: PreviewLocale }[];
  images: { file: string; theme: PreviewTheme; locale: PreviewLocale }[];
  /** Files the page could not show (a missing icon or screenshot). */
  warnings: Issue[];
  /** What the listing checks of `fuyu-plugin check` say about this plugin. */
  listing: Issue[];
}

export declare const DEFAULT_PREVIEW_FILE: "build/preview.html";
export declare const PREVIEW_THEMES: readonly PreviewTheme[];
export declare const PREVIEW_LOCALES: readonly PreviewLocale[];
/**
 * Draw the plugin's market card and detail page from its manifest, icon, screenshots and README, in
 * one self-contained HTML file. An approximation: the styles are the market's own, the markup is
 * rebuilt, and what only the market knows (size, dates, likes, permissions, versions) is left out.
 */
export declare function preview(dir: string, options?: PreviewOptions): Promise<PreviewResult>;
