import { validateIndex } from "./index-format.mjs";
import { isSignatureFile, verifyText } from "./keys.mjs";
import { validateRevoked } from "./revoked.mjs";
import { timeOf } from "./fields.mjs";

const DAY = 24 * 60 * 60 * 1000;
export const INDEX_LIFETIME_DAYS = 7;
export const REVOKED_LIFETIME_DAYS = 90;

const toTime = (now) => (now instanceof Date ? now.getTime() : (now ?? Date.now()));

export function isExpired(doc, { now, lifetimeDays }) {
  const at = toTime(now);
  return at >= timeOf(doc.expires) || at >= timeOf(doc.generatedAt) + lifetimeDays * DAY;
}

export function trustOverlaps(trust) {
  const revocation = new Set((trust?.revocation ?? []).map((key) => key?.keyId));
  return (trust?.index ?? []).some((key) => revocation.has(key?.keyId));
}

function open({ text, signature, keys, trust, lastSerial, now, lifetimeDays, validate }) {
  if (trustOverlaps(trust)) return { status: "rejected", reason: "bad-trust" };
  if (!isSignatureFile(signature)) return { status: "rejected", reason: "bad-signature" };
  const keyId = verifyText(text, signature, keys);
  if (!keyId) return { status: "rejected", reason: "bad-signature" };
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { status: "rejected", reason: "invalid", problems: [{ path: "", message: "not JSON" }] };
  }
  const problems = validate(doc);
  if (problems.length > 0) return { status: "rejected", reason: "invalid", problems };
  if (Number.isSafeInteger(lastSerial) && doc.serial < lastSerial) return { status: "rejected", reason: "older-serial" };
  return { status: isExpired(doc, { now, lifetimeDays }) ? "expired" : "ok", doc, keyId };
}

export function openIndex({ text, signature, trust, lastSerial, now, market }) {
  return open({
    text,
    signature,
    keys: trust?.index ?? [],
    trust,
    lastSerial,
    now,
    lifetimeDays: INDEX_LIFETIME_DAYS,
    validate: (doc) => validateIndex(doc, market),
  });
}

export function openRevoked({ text, signature, trust, lastSerial, now }) {
  return open({
    text,
    signature,
    keys: trust?.revocation ?? [],
    trust,
    lastSerial,
    now,
    lifetimeDays: REVOKED_LIFETIME_DAYS,
    validate: validateRevoked,
  });
}

export function revocationsBehind(index, state) {
  return Number.isSafeInteger(index?.revokedSerial) && (state?.serial ?? -1) < index.revokedSerial;
}
