import { createHash, createHmac } from "node:crypto";
import { encodeSegment } from "./encode.ts";

export type SigningKeys = {
  accessKeyId: string;
  secretAccessKey: string;
};

export type SignInput = {
  method: string;
  url: URL;
  headers: Record<string, string>;
  payloadHash: string;
  keys: SigningKeys;
  region: string;
  now: Date;
  service?: string;
};

const ALGORITHM = "AWS4-HMAC-SHA256";

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Uint8Array, data: string): Uint8Array {
  return createHmac("sha256", key).update(data).digest();
}

export function amzDate(now: Date): string {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalQuery(url: URL): string {
  return [...url.searchParams]
    .map(([name, value]) => [encodeSegment(name), encodeSegment(value)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}

export function signRequest(input: SignInput): Record<string, string> {
  const stamp = amzDate(input.now);
  const day = stamp.slice(0, 8);
  const service = input.service ?? "s3";
  const own: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers)) own[name.toLowerCase()] = value;
  own["x-amz-content-sha256"] = input.payloadHash;
  own["x-amz-date"] = stamp;
  const signedValues: Record<string, string> = { ...own, host: input.url.host };
  const names = Object.keys(signedValues).sort();
  const canonicalHeaders = names.map((name) => `${name}:${signedValues[name].trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");
  const canonical = [input.method, input.url.pathname || "/", canonicalQuery(input.url), canonicalHeaders, signedHeaders, input.payloadHash].join("\n");
  const scope = `${day}/${input.region}/${service}/aws4_request`;
  const toSign = [ALGORITHM, stamp, scope, sha256Hex(canonical)].join("\n");
  let key = hmac(`AWS4${input.keys.secretAccessKey}`, day);
  for (const part of [input.region, service, "aws4_request"]) key = hmac(key, part);
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return {
    ...own,
    authorization: `${ALGORITHM} Credential=${input.keys.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export function errorCodeOf(body: string): string | null {
  const match = /<Code>([^<]{1,80})<\/Code>/.exec(body);
  return match ? match[1].trim() : null;
}
