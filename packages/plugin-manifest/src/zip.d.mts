export interface PackageEntry {
  path: string;
  data: Uint8Array;
}

export declare class PackageError extends Error {
  constructor(code: string, message: string, path?: string);
  code: string;
  path?: string;
}

export declare function createZip(entries: readonly PackageEntry[]): Uint8Array;
export declare function readZip(zip: Uint8Array, limits: { maxFiles: number; maxUnpackedBytes: number }): PackageEntry[];
export { zipEntryNames } from "./executable.mjs";
