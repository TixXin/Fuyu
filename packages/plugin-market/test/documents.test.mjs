import assert from "node:assert/strict";
import { test } from "node:test";
import { openIndex, openRevoked, revocationsBehind, signText, emptyRevocations } from "../src/index.mjs";
import { DAY, NOW, index, makeKey, plugin, reason, revoked, signed } from "./fixtures.mjs";

const indexKey = makeKey();
const revocationKey = makeKey();
const author = makeKey();
const trust = { index: [indexKey.entry], revocation: [revocationKey.entry] };
const doc = () => index([plugin({ author })]);

test("a signed, fresh index opens", () => {
  const { text, signature } = signed(doc(), indexKey.privateKey);
  const opened = openIndex({ text, signature, trust, now: NOW });
  assert.equal(opened.status, "ok");
  assert.equal(opened.keyId, indexKey.entry.keyId);
  assert.equal(opened.doc.plugins[0].name, "@someone/weather");
});

test("CRLF line endings verify the same as LF", () => {
  const { text, signature } = signed(doc(), indexKey.privateKey);
  assert.equal(openIndex({ text: text.replaceAll("\n", "\r\n"), signature, trust, now: NOW }).status, "ok");
});

test("an array of signatures passes when any trusted key signed", () => {
  const stranger = makeKey();
  const { text, signature } = signed(doc(), stranger.privateKey, indexKey.privateKey);
  assert.equal(openIndex({ text, signature, trust, now: NOW }).status, "ok");
});

test("a tampered index or an unknown key is rejected", () => {
  const { text, signature } = signed(doc(), indexKey.privateKey);
  const tampered = text.replace('"serial": 10', '"serial": 11');
  assert.deepEqual(openIndex({ text: tampered, signature, trust, now: NOW }), { status: "rejected", reason: "bad-signature" });
  const stranger = makeKey();
  const other = signed(doc(), stranger.privateKey);
  assert.equal(openIndex({ ...other, trust, now: NOW }).reason, "bad-signature");
  assert.equal(openIndex({ text, signature: { keyId: "x" }, trust, now: NOW }).reason, "bad-signature");
  assert.equal(openIndex({ text, signature: [], trust, now: NOW }).reason, "bad-signature");
});

test("the index only trusts index keys: the revocation key cannot sign it", () => {
  const { text, signature } = signed(doc(), revocationKey.privateKey);
  assert.equal(openIndex({ text, signature, trust, now: NOW }).reason, "bad-signature");
});

test("the revocation list only trusts revocation keys: an index-key-signed list is rejected", () => {
  const list = revoked([{ id: "r1", name: "@someone/weather", version: "*", level: "disable", reason: reason("坏", "bad") }]);
  const byIndexKey = signed(list, indexKey.privateKey);
  assert.equal(openRevoked({ ...byIndexKey, trust, now: NOW }).reason, "bad-signature");
  const byRevocationKey = signed(list, revocationKey.privateKey);
  assert.equal(openRevoked({ ...byRevocationKey, trust, now: NOW }).status, "ok");
});

test("one key in both roles is refused outright", () => {
  const { text, signature } = signed(doc(), indexKey.privateKey);
  const shared = { index: [indexKey.entry], revocation: [indexKey.entry] };
  assert.equal(openIndex({ text, signature, trust: shared, now: NOW }).reason, "bad-trust");
});

test("an index older than the one already seen is rejected; the same serial is fine", () => {
  const { text, signature } = signed(index([plugin({ author })], { serial: 9 }), indexKey.privateKey);
  assert.equal(openIndex({ text, signature, trust, now: NOW, lastSerial: 10 }).reason, "older-serial");
  assert.equal(openIndex({ text, signature, trust, now: NOW, lastSerial: 9 }).status, "ok");
  assert.equal(openIndex({ text, signature, trust, now: NOW, lastSerial: null }).status, "ok");
});

test("the index expires at its expires time", () => {
  const { text, signature } = signed(index([plugin({ author })], { generated: NOW - 8 * DAY }), indexKey.privateKey);
  const opened = openIndex({ text, signature, trust, now: NOW });
  assert.equal(opened.status, "expired");
  assert.ok(opened.doc, "an expired index still opens so installed plugins keep their details");
});

test("the index expires 7 days after generatedAt even if expires says later", () => {
  const { text, signature } = signed(index([plugin({ author })], { generated: NOW - 7 * DAY - 1, lifetime: 30 }), indexKey.privateKey);
  assert.equal(openIndex({ text, signature, trust, now: NOW }).status, "expired");
  const fresh = signed(index([plugin({ author })], { generated: NOW - 6 * DAY, lifetime: 30 }), indexKey.privateKey);
  assert.equal(openIndex({ ...fresh, trust, now: NOW }).status, "ok");
});

test("a signed but malformed index is rejected with the problems", () => {
  const bad = { ...doc(), format: 2 };
  const { text, signature } = signed(bad, indexKey.privateKey);
  const opened = openIndex({ text, signature, trust, now: NOW });
  assert.equal(opened.reason, "invalid");
  assert.deepEqual(opened.problems.map((p) => p.path), ["format"]);
  const notJson = "{";
  assert.equal(openIndex({ text: notJson, signature: signText(notJson, indexKey.privateKey), trust, now: NOW }).reason, "invalid");
});

test("an old revocation list is rejected and a stale one reports expired", () => {
  const list = revoked([], { serial: 3, generated: NOW - 91 * DAY, lifetime: 200 });
  const { text, signature } = signed(list, revocationKey.privateKey);
  assert.equal(openRevoked({ text, signature, trust, now: NOW, lastSerial: 4 }).reason, "older-serial");
  assert.equal(openRevoked({ text, signature, trust, now: NOW, lastSerial: 3 }).status, "expired");
});

test("the index tells when the saved revocations are behind", () => {
  const withSerial = index([], { revokedSerial: 5 });
  assert.equal(revocationsBehind(withSerial, emptyRevocations()), true);
  assert.equal(revocationsBehind(withSerial, { serial: 5, entries: [], withdrawn: [] }), false);
  assert.equal(revocationsBehind(index([]), null), false);
});
