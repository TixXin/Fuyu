import type { PluginManifest, PrivateKeyInput, SigningKeyObject } from "@fuyu/plugin-manifest";
import type { Localized, RevocationState, SignatureObject } from "@fuyu/plugin-market";
import type { Finding, Report } from "@fuyu/plugin-review";

export interface Issue {
  code?: string;
  message: string;
  path?: string;
  file?: string;
  line?: number;
  column?: number;
  domain?: string;
}

export declare class BuildError extends Error {
  issues: Issue[];
  constructor(message: string, issues?: Issue[]);
}

export interface BuildSettings {
  shared?: Readonly<Record<string, string>>;
  hostExternal?: readonly string[];
  appModules?: readonly string[];
  packageDepth?: number | boolean | null;
  nodeTarget?: string;
  browserTarget?: string;
}

export interface BuildOptions extends BuildSettings {
  appKey?: string;
  official?: boolean;
  allowExperimental?: boolean;
  outDir?: string;
}

export interface BuildResult {
  dir: string;
  outDir: string;
  manifest: PluginManifest;
  nodeApis: string[];
  files: string[];
  warnings: Issue[];
}

export interface PackOptions extends BuildOptions {
  file?: string;
  packDir?: string;
  signingKey?: PrivateKeyInput;
}

export interface PackResult extends BuildResult {
  file: string;
  digest: string;
  size: number;
  sha256: string;
  signedBy: string | null;
}

export interface CheckResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  findings: Finding[];
  manifest: PluginManifest | null;
}

export interface EntryPlan {
  host: { output: string; source: string } | null;
  clients: { window: string; output: string; source: string }[];
  config: { output: string; source: string } | null;
}

export interface CommitFields {
  name: string;
  version: string;
  repository: string;
  commit: string;
}

export interface SourceInfo {
  kind: "directory" | "commit";
  spec: string;
  commit?: string;
  skipped?: string[];
}

export interface Writable {
  write(chunk: string): unknown;
}

export declare const VERSION: string;
export declare const DEFAULT_OUT_DIR: string;
export declare const DEFAULT_PACK_DIR: string;
export declare const BUILD_ONLY_FIELDS: readonly string[];
export declare const OUTPUT_DIR: "dist";
export declare const SOURCE_DIR: "src";
export declare const SOURCE_EXTENSIONS: readonly string[];
export declare const DEFAULT_FILES: readonly string[];
export declare const DEFAULT_SHARED_MODULES: Readonly<Record<string, string>>;
export declare const HOST_EXTERNALS: readonly string[];
export declare const APP_MODULES: readonly string[];
export declare const INSTALLED_PACKAGE_DEPTH: 3;
export declare const KEY_ENV: "FUYU_PLUGIN_SIGNING_KEY";
export declare const LEGACY_KEY_ENV: "FLY_ISLAND_PLUGIN_SIGNING_KEY";

export declare function build(dir: string, options?: BuildOptions): Promise<BuildResult>;
export declare function pack(dir: string, options?: PackOptions): Promise<PackResult>;
export interface CheckOptions extends BuildOptions {
  /**
   * What to do with the listing checks (screenshots, description, names): leave them out, report them
   * as warnings, or as errors. Defaults to "off"; the `check` command uses "warn", and "error" with `--strict`.
   */
  listing?: "off" | "warn" | "error";
}

export declare function check(dir: string, options?: CheckOptions): Promise<CheckResult>;
/** The listing checks on their own: what a user would notice on the market card and the plugin page. */
export declare function lintListing(dir: string, manifest: Record<string, unknown> | null, options?: { appKey?: string }): Issue[];
export declare function resolveBuildOptions(options?: BuildOptions): Required<Omit<BuildOptions, "outDir">>;
export declare function readManifest(dir: string): Record<string, unknown>;
export declare function builtManifest(pkg: Record<string, unknown>, appKey: string, nodeApis: string[], builtWith?: string): PluginManifest;
export declare function builtinName(specifier: string): string | null;
export declare function planEntries(dir: string, app: Record<string, unknown>, appKey?: string): EntryPlan;
export declare function sourceFor(dir: string, output: string, field: string): string;
export declare function selectFiles(dir: string, app: Record<string, unknown>, files: readonly string[] | undefined, options?: { exclude?: string[]; warn?: (issue: Issue) => void }): string[];
export declare function compareDeclarations(input: {
  app: Record<string, any>;
  appKey?: string;
  host: { file: string; text: string } | null;
  clients: { file: string; text: string }[];
  nodeApis: string[];
  sourceNodeApis?: unknown;
}): Issue[];
export declare function sharedPath(output: string, target: string, packageDepth?: number | null): string;

export declare function reviewSources(input: {
  oldSpec: string;
  newSpec: string;
  repo?: string;
  path?: string;
  oldBuilt?: string | null;
  newBuilt?: string | null;
}): { report: Report; markdown: string; sources: { old: SourceInfo | null; new: SourceInfo } };

export declare function defaultKeyFile(home?: string): string;
export declare function loadSigningKey(options?: { file?: string; env?: Record<string, string | undefined>; platform?: string; home?: string }): { privateKey: SigningKeyObject; source: string };
export declare function generateSigningKey(options?: { file?: string; platform?: string; home?: string }): { keyId: string; publicKey: string; file: string };
export declare function githubUrl(repository: unknown): string | null;
export declare function commitFields(dir: string, options?: { commit?: string; repository?: string }): CommitFields;
export declare function signCommitAt(
  dir: string,
  privateKey: PrivateKeyInput,
  options?: { commit?: string; repository?: string },
): CommitFields & { authorSignature: SignatureObject; publicKey: string };
export declare function signPackageFile(file: string, privateKey: PrivateKeyInput, out?: string): { file: string; name: string; version: string; digest: string; keyId: string };

export declare function run(argv: string[], io?: { stdout?: Writable; stderr?: Writable; cwd?: string; env?: Record<string, string | undefined> }): Promise<number>;

export interface DevOptions extends BuildOptions {
  dataDir?: string;
  configFile?: string;
  once?: boolean;
  cleanOnly?: boolean;
  debounceMs?: number;
  onRebuild?: (result: BuildResult) => void;
  onError?: (error: unknown) => void;
}

export interface DevSession {
  id: string;
  ymlFile: string;
  cleaned: boolean;
  result: BuildResult | null;
  rebuild?: () => Promise<BuildResult>;
  close: (options?: { clean?: boolean }) => Promise<void>;
}

export declare const DEV_DIR_ENV: "FUYU_PLUGINS_V3_DIR";
export declare function defaultDataDir(home?: string): string;
export declare function registerDevEntry(ymlFile: string, id: string, devOutDir: string): string;
export declare function unregisterDevEntry(ymlFile: string, id: string): boolean;
export declare function dev(dir: string, options?: DevOptions): Promise<DevSession>;

export type PackageConfirmation = {
  readonly unreviewed: boolean;
  readonly displayName?: Localized;
  readonly description?: Localized;
  readonly nodeApis: readonly string[];
  readonly network: readonly string[];
  readonly provides: readonly string[];
  readonly replaces: readonly string[];
  readonly slots: readonly string[];
};

export type InspectedPackage = {
  readonly id: string;
  readonly version: string;
  readonly source: "market" | "manual";
  readonly digest: string;
  readonly sha256: string;
  readonly manifest: Record<string, unknown>;
  readonly files: readonly { path: string; data: Uint8Array }[];
  readonly confirmation: PackageConfirmation;
};

export type InstalledPackageResult = {
  readonly id: string;
  readonly version: string;
  readonly source: "market" | "manual";
  readonly root: string;
  readonly digest: string;
  readonly sha256: string;
  readonly confirmation: PackageConfirmation;
};

export declare const PACKAGES_SUBDIR: "packages";
export type PackageCheckOptions = {
  source?: "market" | "manual";
  allowManual?: boolean;
  /** Validate as an official plugin (`@fuyu/*`). Only callers that know the package is official set this. */
  official?: boolean;
  appVersion?: string;
  expectedSha256?: string;
  /** Reject the package unless its `package.json` name is exactly this (code `name-mismatch`). */
  expectedName?: string;
  /** Reject the package unless its `package.json` version is exactly this (code `version-mismatch`). */
  expectedVersion?: string;
};

export type StagedPackage = {
  readonly id: string;
  readonly version: string;
  readonly source: "market" | "manual";
  readonly digest: string;
  readonly sha256: string;
  readonly confirmation: PackageConfirmation;
  readonly disabled: boolean;
  readonly target: string;
  readonly dir: string;
};

export declare function inspectPackage(zipBuffer: Uint8Array | string, options?: PackageCheckOptions): InspectedPackage;
/** Check a package and write its files to a staging folder; nothing installed changes until `commitStaged`. */
export declare function stagePackage(
  zipBuffer: Uint8Array | string,
  options: PackageCheckOptions & { dir: string; revocations?: RevocationState | null; disabled?: boolean },
): StagedPackage;
/** Swap staged packages into place together; if any step fails, every package and `plugins.yml` go back to how they were. */
export declare function commitStaged(
  dir: string,
  staged: StagedPackage | readonly StagedPackage[],
  options?: { configFile?: string },
): InstalledPackageResult[];
export declare function discardStaged(staged: readonly StagedPackage[]): void;
export declare function installPackage(
  zipBuffer: Uint8Array | string,
  options: PackageCheckOptions & {
    dir: string;
    revocations?: RevocationState | null;
    disabled?: boolean;
    configFile?: string;
  },
): InstalledPackageResult;
export declare function uninstallPackage(
  dir: string,
  id: string,
  options?: { configFile?: string; removeData?: boolean },
): { id: string; removed: boolean };
export declare function applyRevocationsToDir(
  dir: string,
  revocations: RevocationState | null,
  options?: { installed?: readonly { id: string; version: string; source?: string }[]; configFile?: string },
): { disabled: string[]; warned: { id: string; version: string; reasons: Localized[] }[] };
