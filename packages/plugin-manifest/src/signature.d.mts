import type { PluginManifest } from "./manifest.mjs";
import type { PackageEntry, PackageOptions } from "./package.mjs";

export type SignatureRole = "author" | "market";

export interface TrustedKey {
  keyId: string;
  publicKey: string;
}

export interface SignatureEntry {
  role: SignatureRole;
  keyId: string;
  signature: string;
}

export interface SignatureSubject {
  role: SignatureRole;
  name: string;
  version: string;
  digest: string;
}

export interface SignatureFile {
  format: 1;
  name: string;
  version: string;
  digest: string;
  signatures: SignatureEntry[];
}

export interface VerifyPackageResult {
  manifest: PluginManifest;
  digest: string;
  files: PackageEntry[];
  author: string | null;
  market: string | null;
  signed: boolean;
  problems: string[];
}

export interface SigningKeyObject {
  readonly asymmetricKeyType?: string;
}

export type PrivateKeyInput = SigningKeyObject | string | Uint8Array;

export declare const SIGNATURE_FORMAT: 1;
export declare const SIGNATURE_ROLES: readonly SignatureRole[];

export declare function keyIdOf(raw: Uint8Array): string;
export declare function publicKeyOf(privateKey: PrivateKeyInput): TrustedKey;
export declare function generateSigningKey(): TrustedKey & { privateKey: SigningKeyObject };
export declare function signatureText(subject: SignatureSubject, options?: PackageOptions): string;
export declare function signDigest(subject: SignatureSubject, privateKey: PrivateKeyInput, options?: PackageOptions): SignatureEntry;
export declare function verifyDigestSignature(
  entry: unknown,
  subject: SignatureSubject,
  keys: readonly TrustedKey[] | undefined,
  options?: PackageOptions,
): string | null;
export declare function signatureFileFor(manifest: { name: string; version: string }, digest: string, signatures?: SignatureEntry[]): SignatureFile;
export declare function signPackage(zip: Uint8Array, role: SignatureRole, privateKey: PrivateKeyInput, options?: PackageOptions): Uint8Array;
export declare function verifyPackage(
  zip: Uint8Array,
  keys?: { author?: readonly TrustedKey[]; market?: readonly TrustedKey[] },
  options?: PackageOptions,
): VerifyPackageResult;
