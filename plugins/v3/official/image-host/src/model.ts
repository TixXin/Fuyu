import { encodeKey, encodeSegment } from "./encode.ts";

export type CopyFormat = "url" | "markdown";

export type HostConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  pathStyle: boolean;
  prefix: string;
  publicBase: string;
  copyAs: CopyFormat;
};

export type KeyName = "accessKeyId" | "secretAccessKey";

export type SavedKeys = Record<KeyName, boolean>;

export type Missing = "endpoint" | "bucket" | "keys";

export type FailureReason = "auth" | "bucket" | "blocked" | "timeout" | "network" | "server" | "file" | "secrets" | "setup";

export type ErrorInfo = {
  reason: FailureReason;
  status: number;
  code: string | null;
};

export type LastUpload = {
  url: string;
  at: number;
  test: boolean;
};

export type HostState = {
  config: HostConfig;
  keys: SavedKeys;
  missing: Missing[];
  last: LastUpload | null;
  error: ErrorInfo | null;
  busy: boolean;
  at: number;
};

export const SECRET_NAMES: Record<KeyName, string> = {
  accessKeyId: "access-key-id",
  secretAccessKey: "secret-access-key",
};

export const METHODS = {
  state: "state",
  setConfig: "setConfig",
  saveKeys: "saveKeys",
  clearKeys: "clearKeys",
  test: "test",
} as const;

export const TOPICS = { state: "state" } as const;

export const ACTION_ID = "image-host.upload";

export const DEFAULT_CONFIG: HostConfig = {
  endpoint: "",
  region: "auto",
  bucket: "",
  pathStyle: false,
  prefix: "fuyu/",
  publicBase: "",
  copyAs: "url",
};

export const NO_KEYS: SavedKeys = { accessKeyId: false, secretAccessKey: false };

export const EMPTY_STATE: HostState = {
  config: DEFAULT_CONFIG,
  keys: NO_KEYS,
  missing: ["endpoint", "bucket", "keys"],
  last: null,
  error: null,
  busy: false,
  at: 0,
};

const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const REGION = /^[a-z0-9-]{1,40}$/;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const textOf = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : null);

export function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function parseEndpoint(value: string): URL | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol === "https:") return url;
  return url.protocol === "http:" && isLocalHost(url.hostname) ? url : null;
}

export function cleanEndpoint(value: string): string {
  const url = parseEndpoint(value);
  return url ? url.origin : value;
}

export function cleanPrefix(value: string): string {
  const parts = value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && !/^\.+$/.test(part));
  return parts.length ? `${parts.join("/").slice(0, 120)}/` : "";
}

export function cleanPublicBase(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return value;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return value;
  }
}

export function normalizeConfig(input: unknown, base: HostConfig = DEFAULT_CONFIG): HostConfig {
  if (!isObject(input)) return { ...base };
  const next = { ...base };
  const endpoint = textOf(input.endpoint, 300);
  if (endpoint !== null) next.endpoint = cleanEndpoint(endpoint);
  const region = textOf(input.region, 40);
  if (region !== null) next.region = REGION.test(region.toLowerCase()) ? region.toLowerCase() : "auto";
  const bucket = textOf(input.bucket, 63);
  if (bucket !== null) next.bucket = bucket;
  if (typeof input.pathStyle === "boolean") next.pathStyle = input.pathStyle;
  const prefix = textOf(input.prefix, 200);
  if (prefix !== null) next.prefix = cleanPrefix(prefix);
  const publicBase = textOf(input.publicBase, 300);
  if (publicBase !== null) next.publicBase = cleanPublicBase(publicBase);
  if (input.copyAs === "url" || input.copyAs === "markdown") next.copyAs = input.copyAs;
  return next;
}

export function bucketValid(bucket: string): boolean {
  return BUCKET.test(bucket) && !/\.{2}/.test(bucket);
}

export function publicBaseValid(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function missingOf(config: HostConfig, keys: SavedKeys): Missing[] {
  const missing: Missing[] = [];
  if (!parseEndpoint(config.endpoint)) missing.push("endpoint");
  if (!bucketValid(config.bucket)) missing.push("bucket");
  if (!keys.accessKeyId || !keys.secretAccessKey) missing.push("keys");
  return missing;
}

export function usesPathStyle(config: HostConfig): boolean {
  const url = parseEndpoint(config.endpoint);
  return config.pathStyle || (url !== null && isLocalHost(url.hostname));
}

export function objectUrl(config: HostConfig, key: string): URL {
  const endpoint = parseEndpoint(config.endpoint);
  if (!endpoint) throw new Error("image-host: the endpoint is not set");
  if (usesPathStyle(config)) return new URL(`${endpoint.origin}/${encodeSegment(config.bucket)}/${encodeKey(key)}`);
  return new URL(`${endpoint.protocol}//${config.bucket}.${endpoint.host}/${encodeKey(key)}`);
}

export function publicUrl(config: HostConfig, key: string): string {
  if (config.publicBase && publicBaseValid(config.publicBase)) return `${config.publicBase}/${encodeKey(key)}`;
  return objectUrl(config, key).href;
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

export function objectKey(prefix: string, now: Date, random: string): string {
  const year = String(now.getFullYear());
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const clock = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}${year}/${month}/${year}${month}${day}-${clock}-${random}.png`;
}

export function testKey(prefix: string): string {
  return `${prefix}fuyu-image-host-test.png`;
}

export function clipText(format: CopyFormat, url: string): string {
  return format === "markdown" ? `![](${url})` : url;
}

export function normalizeStored(input: unknown): { config: HostConfig; last: LastUpload | null } {
  const stored = isObject(input) ? input : {};
  const last = isObject(stored.last) && typeof stored.last.url === "string" && typeof stored.last.at === "number" ? { url: stored.last.url, at: stored.last.at, test: stored.last.test === true } : null;
  return { config: normalizeConfig(stored.config), last };
}
