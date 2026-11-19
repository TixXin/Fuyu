export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  pre: string[];
}

export declare function parseVersion(text: unknown): SemVer | null;
export declare function isValidVersion(text: unknown): boolean;
export declare function compareVersions(left: string | SemVer, right: string | SemVer): number;
export declare function isValidRange(text: unknown): boolean;
export declare function satisfies(version: string, range: string, options?: { readonly includePrerelease?: boolean }): boolean;
