export type Localized = { readonly "zh-CN": string; readonly en: string };
export type Platform = "windows" | "macos";
export type Time = string;
export type PrivateKeyInput = string | { readonly type: "private" };

export type PublicKeyEntry = { readonly keyId: string; readonly publicKey: string };
export type SignatureObject = { readonly keyId: string; readonly signature: string };
export type SignatureFile = SignatureObject | readonly SignatureObject[];
export type AuthorKey = PublicKeyEntry & { readonly endorsedBy?: SignatureObject };
export type Trust = { readonly index: readonly PublicKeyEntry[]; readonly revocation: readonly PublicKeyEntry[] };
export type Problem = { readonly path: string; readonly message: string };

export type Asset = { readonly url: string; readonly sha256: string };
export type Screenshot = Asset & { readonly caption?: Localized };

export type ManifestSummary = {
  readonly displayName: Localized;
  readonly description: Localized;
  readonly license: string;
  readonly categories?: readonly string[];
  readonly preview?: boolean;
  readonly requires?: Readonly<Record<string, string>>;
  readonly nodeApis: readonly string[];
  readonly network: readonly string[];
  readonly inject: { readonly required: readonly string[]; readonly optional: readonly string[] };
  readonly provides: readonly string[];
  readonly replaces: readonly string[];
  readonly slots: readonly string[];
  readonly commands: readonly { readonly id: string; readonly title?: Localized; readonly keybinding?: string }[];
};

export type VersionEntry = {
  readonly version: string;
  readonly repository: string;
  readonly commit: string;
  readonly engines: { readonly fuyu: string };
  readonly platforms: readonly Platform[];
  readonly url: string;
  readonly sha256: string;
  readonly size: number;
  readonly publishedAt: Time;
  readonly reviewedAt: Time;
  readonly urgent?: { readonly reason: Localized };
  readonly authorSignature?: SignatureObject;
  readonly manifest: ManifestSummary;
  readonly icon: Asset;
  readonly screenshots?: readonly Screenshot[];
};

export type Publisher = {
  readonly github: string;
  readonly official: boolean;
  readonly verified?: { readonly via: "github" } | { readonly via: "domain"; readonly domain: string };
};

export type PluginEntry = {
  readonly name: string;
  readonly publisher: Publisher;
  readonly authorKeys: readonly AuthorKey[];
  readonly versions: readonly VersionEntry[];
};

type Header = { readonly format: 3; readonly serial: number; readonly generatedAt: Time; readonly expires: Time };

export type IndexV3 = Header & { readonly revokedSerial?: number; readonly plugins: readonly PluginEntry[] };

export type RevocationLevel = "warn" | "disable";
export type RevocationEntry = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly level: RevocationLevel;
  readonly reason: Localized;
};
export type Withdrawal = { readonly id: string; readonly reason: Localized };
export type RevokedV3 = Header & { readonly entries: readonly RevocationEntry[]; readonly withdrawn: readonly Withdrawal[] };
export type RevocationState = { readonly serial: number; readonly entries: readonly RevocationEntry[]; readonly withdrawn: readonly Withdrawal[] };

export type MarketOptions = { readonly officialScope?: string; readonly officialRepository?: string };

export declare function parseVersion(text: unknown): { major: number; minor: number; patch: number; prerelease: (string | number)[] } | null;
export declare function isValidVersion(text: unknown): boolean;
export declare function isPrerelease(text: unknown): boolean;
export declare function compareVersions(a: string, b: string): -1 | 0 | 1;
export declare function isValidRange(text: unknown): boolean;
export declare function satisfies(version: string, range: string): boolean;

export declare function signedBytes(text: string): Uint8Array;
export declare function keyIdOf(raw: Uint8Array): string;
export declare function isPublicKeyEntry(value: unknown): value is PublicKeyEntry;
export declare function isSignatureFile(value: unknown): value is SignatureFile;
export declare function publicKeyOf(privateKey: PrivateKeyInput): PublicKeyEntry;
export declare function signText(text: string, privateKey: PrivateKeyInput): SignatureObject;
export declare function verifyText(text: string, signature: unknown, keys: readonly PublicKeyEntry[]): string | null;

export type CommitFields = { readonly name: string; readonly version: string; readonly repository: string; readonly commit: string };
export declare const COMMIT_DOMAIN: "fuyu-plugin-commit/1";
export declare const KEY_DOMAIN: "fuyu-plugin-key/1";
export declare function commitText(fields: CommitFields): string;
export declare function signCommit(fields: CommitFields, privateKey: PrivateKeyInput): SignatureObject;
export declare function verifyCommit(fields: CommitFields, signature: unknown, keys: readonly PublicKeyEntry[]): string | null;
export declare function endorsementText(name: string, key: PublicKeyEntry): string;
export declare function endorseKey(name: string, newKey: PublicKeyEntry, oldPrivateKey: PrivateKeyInput): AuthorKey;
export declare function verifyEndorsement(name: string, key: AuthorKey, keys: readonly PublicKeyEntry[]): string | null;
export declare function verifyVersionSignature(plugin: PluginEntry, entry: VersionEntry): string | null;

export type AuthorPin = { readonly keyIds: readonly string[]; readonly repository: string };
export type AuthorStatus = "official" | "first" | "same" | "rotated" | "changed" | "bad-signature";
export type AuthorCheck = {
  readonly status: AuthorStatus;
  readonly install: boolean;
  readonly autoUpdate: boolean;
  readonly confirm: "none" | "once" | "twice";
  readonly signedBy: string | null;
  readonly pin: AuthorPin | null;
};
export declare function checkAuthor(input: { plugin: PluginEntry; entry: VersionEntry; pin?: AuthorPin | null }): AuthorCheck;

export declare const FORMAT: 3;
export declare const PLATFORMS: readonly Platform[];
export declare const MAX_SCREENSHOTS: number;
export declare const DEFAULT_MARKET: Required<MarketOptions>;
export declare function parseName(name: unknown): { scope: string; name: string } | null;
export declare function validateIndex(doc: unknown, options?: MarketOptions): Problem[];

export declare const LEVELS: readonly RevocationLevel[];
export declare function validateRevoked(doc: unknown): Problem[];
export declare function emptyRevocations(): RevocationState;
export type MergeResult =
  | { readonly ok: true; readonly state: RevocationState; readonly added: readonly string[]; readonly withdrawn: readonly string[] }
  | { readonly ok: false; readonly reason: "older-serial"; readonly state: RevocationState };
export declare function mergeRevoked(saved: RevocationState | null, incoming: RevokedV3): MergeResult;
export declare function activeRevocations(state: RevocationState | null): RevocationEntry[];
export declare function revocationOf(
  state: RevocationState | null,
  name: string,
  version: string,
): { level: RevocationLevel; entries: RevocationEntry[] } | null;

type Now = number | Date;
export type Opened<T> =
  | { readonly status: "ok" | "expired"; readonly doc: T; readonly keyId: string }
  | { readonly status: "rejected"; readonly reason: "bad-trust" | "bad-signature" | "invalid" | "older-serial"; readonly problems?: readonly Problem[] };
export declare const INDEX_LIFETIME_DAYS: 7;
export declare const REVOKED_LIFETIME_DAYS: 90;
export declare function trustOverlaps(trust: Trust): boolean;
export declare function isExpired(doc: Header, options: { now?: Now; lifetimeDays: number }): boolean;
export declare function openIndex(input: {
  text: string;
  signature: unknown;
  trust: Trust;
  lastSerial?: number | null;
  now?: Now;
  market?: MarketOptions;
}): Opened<IndexV3>;
export declare function openRevoked(input: { text: string; signature: unknown; trust: Trust; lastSerial?: number | null; now?: Now }): Opened<RevokedV3>;
export declare function revocationsBehind(index: IndexV3, state: RevocationState | null): boolean;

export declare const COOLDOWN_DAYS: 3;
export declare function cooledDown(entry: VersionEntry, now?: Now, cooldownDays?: number): boolean;
export type Selection = {
  readonly manual: { readonly entry: VersionEntry; readonly cooled: boolean; readonly warned: boolean } | null;
  readonly autoUpdate: { readonly entry: VersionEntry; readonly urgent: boolean } | null;
  readonly install: { readonly entry: VersionEntry; readonly fresh: boolean } | null;
  readonly skipped: readonly { readonly version: string; readonly reason: "platform" | "engines" | "prerelease" | "revoked" }[];
};
export declare function selectVersions(
  plugin: PluginEntry,
  options: {
    fuyuVersion: string;
    platform: Platform;
    now?: Now;
    installed?: string | null;
    revocations?: RevocationState | null;
    prerelease?: boolean;
    cooldownDays?: number;
  },
): Selection;
