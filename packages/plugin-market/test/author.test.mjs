import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAuthor, commitText, endorseKey, signCommit, verifyCommit, verifyVersionSignature } from "../src/index.mjs";
import { commitOf, makeKey, plugin, version } from "./fixtures.mjs";

const name = "@someone/weather";
const repository = "https://github.com/someone/weather";
const fields = { name, version: "1.0.0", repository, commit: commitOf(1) };

test("the signed commit text is the domain, name, version, repository and commit on separate lines", () => {
  assert.equal(commitText(fields), `fuyu-plugin-commit/1\n${name}\n1.0.0\n${repository}\n${commitOf(1)}`);
  assert.throws(() => commitText({ ...fields, version: "1.0.0\nevil" }));
  assert.throws(() => commitText({ ...fields, commit: "" }));
});

test("a commit signature verifies only for the same fields", () => {
  const key = makeKey();
  const signature = signCommit(fields, key.privateKey);
  assert.equal(verifyCommit(fields, signature, [key.entry]), key.entry.keyId);
  for (const change of [{ name: "@someone/other" }, { version: "1.0.1" }, { repository: "https://github.com/someone/fork" }, { commit: commitOf(2) }]) {
    assert.equal(verifyCommit({ ...fields, ...change }, signature, [key.entry]), null, JSON.stringify(change));
  }
  assert.equal(verifyCommit(fields, signature, [makeKey().entry]), null);
  assert.equal(verifyCommit({ ...fields, commit: undefined }, signature, [key.entry]), null);
});

test("a key entry whose keyId does not match its public key is ignored", () => {
  const key = makeKey();
  const other = makeKey();
  const signature = signCommit(fields, key.privateKey);
  assert.equal(verifyCommit(fields, signature, [{ keyId: key.entry.keyId, publicKey: other.entry.publicKey }]), null);
});

test("the version signature comes from the plugin's authorKeys", () => {
  const author = makeKey();
  const p = plugin({ author });
  assert.equal(verifyVersionSignature(p, p.versions[0]), author.entry.keyId);
  assert.equal(verifyVersionSignature({ ...p, authorKeys: [makeKey().entry] }, p.versions[0]), null);
});

test("first install pins the key and repository; the same key updates silently", () => {
  const author = makeKey();
  const p = plugin({ author });
  const first = checkAuthor({ plugin: p, entry: p.versions[0] });
  assert.equal(first.status, "first");
  assert.deepEqual(first.pin, { keyIds: [author.entry.keyId], repository });
  const next = plugin({ author, versions: [version(name, author, { v: "1.1.0", seed: 2 })] });
  const same = checkAuthor({ plugin: next, entry: next.versions[0], pin: first.pin });
  assert.equal(same.status, "same");
  assert.equal(same.autoUpdate, true);
});

test("a new key endorsed by the pinned one is a rotation: no auto-update, one confirmation", () => {
  const oldKey = makeKey();
  const newKey = makeKey();
  const endorsed = endorseKey(name, newKey.entry, oldKey.privateKey);
  const p = plugin({ author: newKey, keys: [oldKey.entry, endorsed], versions: [version(name, newKey, { v: "2.0.0" })] });
  const result = checkAuthor({ plugin: p, entry: p.versions[0], pin: { keyIds: [oldKey.entry.keyId], repository } });
  assert.equal(result.status, "rotated");
  assert.equal(result.autoUpdate, false);
  assert.equal(result.confirm, "once");
  assert.deepEqual(result.pin.keyIds, [newKey.entry.keyId]);
});

test("endorsements chain through intermediate keys", () => {
  const a = makeKey();
  const b = makeKey();
  const c = makeKey();
  const keys = [a.entry, endorseKey(name, b.entry, a.privateKey), endorseKey(name, c.entry, b.privateKey)];
  const p = plugin({ author: c, keys, versions: [version(name, c)] });
  assert.equal(checkAuthor({ plugin: p, entry: p.versions[0], pin: { keyIds: [a.entry.keyId], repository } }).status, "rotated");
});

test("an unendorsed key, or one endorsed for another plugin, is a changed key", () => {
  const oldKey = makeKey();
  const newKey = makeKey();
  const pin = { keyIds: [oldKey.entry.keyId], repository };
  const bare = plugin({ author: newKey, keys: [oldKey.entry, newKey.entry] });
  const changed = checkAuthor({ plugin: bare, entry: bare.versions[0], pin });
  assert.equal(changed.status, "changed");
  assert.equal(changed.autoUpdate, false);
  assert.equal(changed.confirm, "twice");
  const elsewhere = endorseKey("@someone/other", newKey.entry, oldKey.privateKey);
  const moved = plugin({ author: newKey, keys: [oldKey.entry, elsewhere] });
  assert.equal(checkAuthor({ plugin: moved, entry: moved.versions[0], pin }).status, "changed");
});

test("a moved repository counts as changed even with the same key", () => {
  const author = makeKey();
  const p = plugin({ author, versions: [version(name, author, { repository: "https://github.com/someone/weather-next" })] });
  const result = checkAuthor({ plugin: p, entry: p.versions[0], pin: { keyIds: [author.entry.keyId], repository } });
  assert.equal(result.status, "changed");
});

test("a missing or forged signature blocks the install", () => {
  const author = makeKey();
  const unsigned = plugin({ author, versions: [version(name, author, { sign: false })] });
  const result = checkAuthor({ plugin: unsigned, entry: unsigned.versions[0] });
  assert.equal(result.status, "bad-signature");
  assert.equal(result.install, false);
});

test("official plugins are pinned by repository only", () => {
  const p = {
    name: "@fuyu/countdown",
    publisher: { github: "TixXin", official: true },
    authorKeys: [],
    versions: [version("@fuyu/countdown", null, { repository: "https://github.com/TixXin/fuyu", sign: false })],
  };
  const first = checkAuthor({ plugin: p, entry: p.versions[0] });
  assert.equal(first.status, "official");
  assert.equal(checkAuthor({ plugin: p, entry: p.versions[0], pin: first.pin }).status, "official");
  assert.equal(checkAuthor({ plugin: p, entry: p.versions[0], pin: { keyIds: [], repository: "https://github.com/x/y" } }).status, "changed");
});
