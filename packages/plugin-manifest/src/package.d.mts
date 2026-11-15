import type { PluginManifest } from "./manifest.mjs";
import type { PackageEntry } from "./zip.mjs";

export { PackageError } from "./zip.mjs";
export type { PackageEntry } from "./zip.mjs";

export interface PackageOptions {
  namespace?: string;
  extension?: string;
  signatureFile?: string;
  maxPackageBytes?: number;
  maxUnpackedBytes?: number;
  maxFiles?: number;
}

export interface ResolvedPackageOptions {
  namespace: string;
  extension: string;
  signatureFile: string;
  maxPackageBytes: number;
  maxUnpackedBytes: number;
  maxFiles: number;
}

export interface PackedPackage {
  zip: Uint8Array;
  digest: string;
  manifest: PluginManifest;
  files: PackageEntry[];
}

export interface ReadPackageResult {
  files: PackageEntry[];
  manifest: PluginManifest;
  digest: string;
  signatures: unknown;
}

export declare const DEFAULT_NAMESPACE: "fuyu";
export declare const MAX_PACKAGE_BYTES: number;
export declare const MAX_UNPACKED_BYTES: number;
export declare const MAX_FILES: number;
export declare const MANIFEST_FILE: "package.json";
export declare const TEXT_EXTENSIONS: readonly string[];
export declare const BLOCKED_EXTENSIONS: readonly string[];

export declare function resolvePackageOptions(options?: PackageOptions): ResolvedPackageOptions;
export declare function checkPackagePath(path: unknown): { code: string; message: string } | null;
export declare function executableKind(data: Uint8Array): "PE" | "Mach-O" | "ELF" | null;
export declare function normalizeText(path: string, data: Uint8Array): Uint8Array;
export declare function sha256Hex(data: Uint8Array | string): string;
export declare function packageDigest(entries: readonly PackageEntry[], options?: PackageOptions): string;
export declare function packFiles(
  files: ReadonlyArray<{ path: string; data: Uint8Array | string }>,
  options?: PackageOptions & { normalizeText?: boolean },
): PackedPackage;
export declare function collectFiles(dir: string): PackageEntry[];
export declare function packDirectory(dir: string, options?: PackageOptions): PackedPackage;
export declare function readPackage(zip: Uint8Array, options?: PackageOptions): ReadPackageResult;
export declare function packageFileName(name: string, version: string, options?: PackageOptions): string;
