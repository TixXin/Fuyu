export type LocalizedText = Record<string, string>;

export interface PluginCommand {
  id: string;
  title: LocalizedText;
  keybinding?: string;
}

export interface PluginScreenshot {
  path: string;
  caption?: LocalizedText;
}

export interface AppManifest {
  manifest: 1;
  displayName: LocalizedText;
  description: LocalizedText;
  icon: string;
  categories: string[];
  screenshots?: PluginScreenshot[];
  preview?: boolean;
  platforms?: Array<"windows" | "macos" | "linux">;
  host?: string;
  client?: Record<string, string>;
  inject?: { required?: string[]; optional?: string[] };
  requires?: Record<string, string>;
  provides?: string[];
  replaces?: string[];
  slots?: string[];
  commands?: PluginCommand[];
  network?: string[];
  config?: string;
  experimental?: string[];
  nodeApis?: string[];
  builtWith?: string;
  [unknown: string]: unknown;
}

export interface PluginManifest {
  name: string;
  version: string;
  type: "module";
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  license: string;
  homepage?: string;
  repository: string | { type?: string; url: string; directory?: string };
  bugs?: string | { url?: string; email?: string };
  funding?: string | { type?: string; url: string } | Array<string | { type?: string; url: string }>;
  keywords?: string[];
  files?: string[];
  engines: Record<string, string>;
  [key: string]: unknown;
}

export interface ValidateManifestOptions {
  appKey?: string;
  officialScope?: string;
  official?: boolean;
  stage?: "source" | "built";
  appVersion?: string;
  allowExperimental?: boolean;
  categories?: readonly string[];
}

export interface ManifestIssue {
  path: string;
  code: string;
  message: string;
}

export interface ValidateManifestResult {
  ok: boolean;
  errors: ManifestIssue[];
  warnings: ManifestIssue[];
  manifest: PluginManifest | null;
  app: AppManifest | null;
}

export declare const DEFAULT_APP_KEY: "fuyu";
export declare const DEFAULT_OFFICIAL_SCOPE: "fuyu";
export declare const MANIFEST_VERSION: 1;
export declare const REQUIRED_LOCALES: readonly string[];
export declare const DEFAULT_CATEGORIES: readonly string[];
export declare const PLATFORMS: readonly ["windows", "macos", "linux"];
export declare const MAX_SCREENSHOTS: number;
export declare const GENERATED_FIELDS: readonly ["nodeApis", "builtWith"];
export declare const NPM_FIELDS: readonly string[];
export declare const APP_FIELDS: readonly string[];

export declare function isSafeRelativePath(path: unknown): boolean;

export declare function validateManifest(pkg: unknown, options?: ValidateManifestOptions): ValidateManifestResult;
