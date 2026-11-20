import { objectUrl, type ErrorInfo, type FailureReason, type HostConfig } from "./model.ts";
import { errorCodeOf, sha256Hex, signRequest, type SigningKeys } from "./s3.ts";

export type UploadFailure = Error & { reason: FailureReason; status: number; s3Code: string | null };

type ResponseLike = { ok: boolean; status: number; text(): Promise<string> };

export type FetchLike = (input: string, init: Record<string, unknown>) => Promise<ResponseLike>;

export type PutRequest = {
  config: HostConfig;
  keys: SigningKeys;
  key: string;
  body: Uint8Array;
  now: Date;
  timeoutMs?: number;
};

const AUTH_CODES = new Set(["AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "AuthorizationHeaderMalformed", "InvalidToken", "ExpiredToken"]);

export const TEST_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export function testPicture(): Uint8Array {
  return Uint8Array.from(atob(TEST_PNG), (char) => char.charCodeAt(0));
}

export function failure(reason: FailureReason, status = 0, s3Code: string | null = null): UploadFailure {
  return Object.assign(new Error(`image-host: upload failed (${reason}${status ? ` ${status}` : ""}${s3Code ? ` ${s3Code}` : ""})`), { reason, status, s3Code });
}

export function isFailure(error: unknown): error is UploadFailure {
  return error instanceof Error && typeof (error as Partial<UploadFailure>).reason === "string";
}

function reasonOfThrown(error: unknown): FailureReason {
  const value = error as { code?: unknown; name?: unknown } | null;
  if (value?.code === "undeclared-network") return "blocked";
  if (value?.name === "TimeoutError" || value?.name === "AbortError") return "timeout";
  return "network";
}

export async function putObject(fetch: FetchLike, request: PutRequest): Promise<URL> {
  const url = objectUrl(request.config, request.key);
  const headers = signRequest({
    method: "PUT",
    url,
    headers: { "content-type": "image/png" },
    payloadHash: sha256Hex(request.body),
    keys: request.keys,
    region: request.config.region || "auto",
    now: request.now,
  });
  let response: ResponseLike;
  try {
    response = await fetch(url.href, { method: "PUT", headers, body: request.body, signal: AbortSignal.timeout(request.timeoutMs ?? 45_000) });
  } catch (error) {
    throw failure(reasonOfThrown(error));
  }
  if (response.ok) return url;
  const s3Code = errorCodeOf(await response.text().catch(() => ""));
  if (response.status === 401 || response.status === 403 || (s3Code !== null && AUTH_CODES.has(s3Code))) throw failure("auth", response.status, s3Code);
  if (response.status === 404 || s3Code === "NoSuchBucket") throw failure("bucket", response.status, s3Code);
  throw failure("server", response.status, s3Code);
}

export function errorInfo(error: unknown): ErrorInfo {
  return isFailure(error) ? { reason: error.reason, status: error.status, code: error.s3Code } : { reason: "network", status: 0, code: null };
}
