import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createCertificate, IDENTITY } from "../../scripts/macos/self-signed-cert.mjs";

const hasOpenssl = spawnSync("openssl", ["version"]).status === 0;

test("the self-signed certificate is made once, for code signing, and kept private", { skip: !hasOpenssl }, () => {
  const dir = join(mkdtempSync(join(tmpdir(), "fuyu-cert-")), "macos");
  const first = createCertificate(dir);
  assert.equal(first.created, true);
  assert.equal(createCertificate(dir).created, false, "an existing certificate is kept so permissions survive updates");
  const text = spawnSync("openssl", ["x509", "-in", first.files.pem, "-noout", "-text"], { encoding: "utf8" }).stdout;
  assert.match(text, new RegExp(`CN\\s*=\\s*${IDENTITY}`));
  assert.match(text, /Code Signing/);
  if (process.platform !== "win32") {
    assert.equal(statSync(first.files.p12).mode & 0o077, 0);
    assert.equal(statSync(first.files.password).mode & 0o077, 0);
  }
});
