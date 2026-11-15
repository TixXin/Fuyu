import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { verifyPackage } from "@fuyu/plugin-manifest";
import { publicKeyOf, verifyCommit } from "@fuyu/plugin-market";
import { KEY_ENV, defaultKeyFile, generateSigningKey, githubUrl, loadSigningKey, pack, signCommitAt, signPackageFile } from "../src/index.mjs";
import { copyFixture, editJson, gitRepo, tempDir } from "./helpers.mjs";

const POSIX = { platform: "linux" };

test("keygen writes one key file, refuses to replace it, and the key loads back", () => {
  const file = join(tempDir("keys"), "signing.key");
  const key = generateSigningKey({ file, ...POSIX });
  assert.match(key.keyId, /^[0-9a-f]{16}$/);
  if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.throws(() => generateSigningKey({ file, ...POSIX }), (error) => error.code === "exists");
  const loaded = loadSigningKey({ file, env: {}, ...POSIX });
  assert.equal(loaded.source, file);
  assert.equal(publicKeyOf(loaded.privateKey).keyId, key.keyId);
});

test("keys come from --key, then the environment, then the 1.x key file", () => {
  const home = tempDir("home");
  assert.equal(defaultKeyFile(home), join(home, ".fuyu-plugin", "signing.key"));
  const legacy = join(home, ".fly-island-plugin", "signing.key");
  mkdirSync(join(home, ".fly-island-plugin"));
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  writeFileSync(legacy, pem);
  assert.equal(defaultKeyFile(home), legacy);
  assert.equal(loadSigningKey({ env: {}, home, ...POSIX }).source, legacy);
  assert.equal(loadSigningKey({ env: { [KEY_ENV]: pem }, home, ...POSIX }).source, `$${KEY_ENV}`);
  assert.equal(loadSigningKey({ env: { FLY_ISLAND_PLUGIN_SIGNING_KEY: pem }, home, ...POSIX }).source, "$FLY_ISLAND_PLUGIN_SIGNING_KEY");
  assert.equal(loadSigningKey({ file: legacy, env: { [KEY_ENV]: "not a key" }, ...POSIX }).source, legacy);
  const rsa = join(home, "rsa.key");
  writeFileSync(rsa, generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ format: "pem", type: "pkcs8" }));
  assert.throws(() => loadSigningKey({ file: rsa, ...POSIX }), /signing keys are Ed25519/);
  assert.throws(() => loadSigningKey({ env: {}, home: tempDir("empty"), ...POSIX }), /fuyu-plugin keygen/);
});

test("sign signs the commit's name, version, repository and commit id for the market", () => {
  const repo = tempDir("signed");
  const git = gitRepo(repo);
  const plugin = copyFixture("hello", () => {}, join(repo, "plugins"));
  const commit = git.commit("hello 1.0.0");
  editJson(join(plugin, "package.json"), (pkg) => (pkg.version = "1.0.1"));
  const { privateKey } = generateKeyPairSync("ed25519");
  const signed = signCommitAt(plugin, privateKey);
  assert.deepEqual(
    { name: signed.name, version: signed.version, repository: signed.repository, commit: signed.commit },
    { name: "@someone/fuyu-hello", version: "1.0.0", repository: "https://github.com/someone/fuyu-hello", commit },
  );
  const key = { keyId: signed.authorSignature.keyId, publicKey: signed.publicKey };
  assert.equal(verifyCommit(signed, signed.authorSignature, [key]), key.keyId);
  assert.equal(verifyCommit({ ...signed, version: "1.0.1" }, signed.authorSignature, [key]), null);
  assert.throws(() => signCommitAt(plugin, privateKey, { commit: "nope" }), /is not a commit/);
  editJson(join(plugin, "package.json"), (pkg) => (pkg.repository = "gitlab:someone/fuyu-hello"));
  git.commit("move to gitlab");
  assert.throws(() => signCommitAt(plugin, privateKey), /only takes GitHub repositories/);
  assert.equal(githubUrl("git+https://github.com/Someone/fuyu-hello.git"), "https://github.com/Someone/fuyu-hello");
});

test("pack --sign and sign <file.fuyu> add the author signature without changing the digest", async () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const key = publicKeyOf(privateKey);
  const signed = await pack(copyFixture(), { signingKey: privateKey });
  const unsigned = await pack(copyFixture());
  assert.equal(signed.digest, unsigned.digest);
  assert.equal(signed.signedBy, key.keyId);
  assert.equal(verifyPackage(readFileSync(signed.file), { author: [key] }).author, key.keyId);
  assert.equal(verifyPackage(readFileSync(unsigned.file), { author: [key] }).author, null);
  const later = signPackageFile(unsigned.file, privateKey, join(tempDir("out"), "signed.fuyu"));
  assert.equal(later.digest, unsigned.digest);
  assert.ok(existsSync(later.file));
  assert.equal(verifyPackage(readFileSync(later.file), { author: [key] }).author, key.keyId);
});
