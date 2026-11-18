import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { review } from "../../packages/plugin-review/src/index.mjs";
import { translatorV1 } from "../../packages/plugin-services/src/index.mjs";
import { LONG_SENTENCE_MESSAGE, loadDefaultEcdictEngine } from "../../plugins/v3/official/ecdict/src/dictionary.ts";

const BUILTINS_DIR = fileURLToPath(new URL("../../src/features/", import.meta.url));
const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/ecdict", import.meta.url));
const PLUGIN_ID = "@fuyu/ecdict";

const scratch = mkdtempSync(join(tmpdir(), "fuyu-ecdict-plugin-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function createFakeRust(methods) {
  const toHost = new PassThrough();
  const fromHost = new PassThrough();
  const calls = [];
  const send = (message) => toHost.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  createInterface({ input: fromHost }).on("line", async (line) => {
    const message = JSON.parse(line);
    calls.push(message);
    if (message.id === undefined) return;
    const handler = methods[message.method];
    if (!handler) {
      send({ id: message.id, error: { code: "no-method", message: `missing ${message.method}` } });
      return;
    }
    const result = await handler(message.params);
    send({ id: message.id, result });
  });
  const rpc = connect({ input: toHost, write: (chunk) => fromHost.write(chunk) });
  return {
    rpc,
    callsFor: (method) => calls.filter((item) => item.method === method),
  };
}

async function waitUntil(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
}

test("@fuyu/ecdict passes check, pack, review, registers ecdict on translator/v1, and withdraws on disable", async () => {
  assert.equal(existsSync(join(PLUGIN_DIR, "dist")), false);
  assert.equal(existsSync(join(PLUGIN_DIR, "build")), false);

  const checkResult = await check(PLUGIN_DIR, { official: true, allowExperimental: false });
  assert.equal(checkResult.ok, true, JSON.stringify(checkResult.errors));
  assert.deepEqual(checkResult.errors, []);
  assert.deepEqual(checkResult.warnings, []);

  const packed = await pack(PLUGIN_DIR, {
    official: true,
    allowExperimental: false,
    outDir: join(scratch, "built"),
    packDir: join(scratch, "packed"),
  });
  assert.equal(packed.manifest.name, PLUGIN_ID);
  assert.equal(packed.manifest.fuyu.network, undefined);
  assert.deepEqual(packed.manifest.fuyu.nodeApis, ["fs", "path", "url"]);
  assert.equal(existsSync(packed.file), true);
  const archiveSize = statSync(packed.file).size;
  assert.ok(archiveSize > 50_000 && archiveSize < 1_500_000, `unexpected archive size: ${archiveSize}`);

  const report = review({
    oldDir: null,
    newDir: PLUGIN_DIR,
    newBuilt: packed.outDir,
  });
  assert.deepEqual(
    report.findings.filter((item) => item.tier === "red"),
    [],
  );
  assert.deepEqual(report.summary.network.declared, []);
  assert.deepEqual(report.summary.network.undeclared, []);

  const hostDir = join(scratch, "host-data");
  mkdirSync(hostDir, { recursive: true });
  const installed = installPackage(packed.file, {
    dir: hostDir,
    source: "market",
    expectedSha256: packed.sha256,
  });
  assert.equal(installed.id, PLUGIN_ID);

  const rust = createFakeRust({
    "translator.engines": () => ({ engines: [{ engine: "deepseek", hasSecret: false }] }),
  });

  const host = await startHost({
    dir: hostDir,
    builtins: BUILTINS_DIR,
    appVersion: "0.4.0",
    rpc: rust.rpc,
  });
  try {
    let translator;
    await host.ctx.plugin({
      name: "ecdict-test-caller",
      apply(ctx) {
        translator = ctx.services.get(translatorV1);
      },
    });

    await host.settle();
    const ready = await waitUntil(
      () => host.status().find((entry) => entry.id === PLUGIN_ID)?.state === "running",
    );
    assert.equal(ready, true, JSON.stringify(host.status()));

    const status = host.status().find((entry) => entry.id === PLUGIN_ID);
    assert.equal(status?.source, "market");
    assert.equal(status?.undeclared, undefined);

    const listed = await translator.engines();
    const ecdictInfo = listed.engines.find((item) => item.engine === "ecdict");
    assert.deepEqual(ecdictInfo, {
      engine: "ecdict",
      hasSecret: true,
      label: {
        "zh-CN": "ECDICT 离线词典",
        en: "ECDICT Offline Dictionary",
      },
      defaultModel: "offline",
    });

    const result = await translator.translate({
      text: '  "Asynchronous!"  ',
      direction: "auto",
      engine: { engine: "ecdict" },
    });
    assert.equal(result.engine, "ecdict");
    assert.match(result.text, /asynchronous/);
    assert.match(result.text, /\/.+\//);
    assert.match(result.text, /异步/);
    assert.equal(rust.callsFor("translator.translate").length, 0);

    await assert.rejects(
      () =>
        translator.rewrite({
          text: "asynchronous",
          task: "polish",
          engine: { engine: "ecdict" },
        }),
      { code: "unsupported" },
    );

    host.bisect([PLUGIN_ID]);
    const withdrawn = await waitUntil(async () => {
      const next = await translator.engines();
      return !next.engines.some((item) => item.engine === "ecdict");
    });
    assert.equal(withdrawn, true);

    host.bisect([]);
    const restored = await waitUntil(async () => {
      const next = await translator.engines();
      return next.engines.some((item) => item.engine === "ecdict");
    });
    assert.equal(restored, true);
  } finally {
    await host.stop();
  }
});

test("ECDICT engine supports exact words, phrases, lemmatization, Chinese lookup, and long-sentence hints", () => {
  const engine = loadDefaultEcdictEngine();
  assert.ok(engine.size >= 10_000);

  const exact = engine.translate('  "Apple."  ', "en-zh");
  assert.match(exact, /^apple\s+\/.+\//);
  assert.match(exact, /苹果/);

  const phrase = engine.translate("Look Up!", "auto");
  assert.match(phrase, /^look up/m);
  assert.match(phrase, /查阅|查寻|向上看/);

  const regularCases = [
    ["apples", "apple"],
    ["boxes", "box"],
    ["studies", "study"],
    ["wolves", "wolf"],
    ["worked", "work"],
    ["studied", "study"],
    ["stopped", "stop"],
    ["making", "make"],
    ["bigger", "big"],
    ["happiest", "happy"],
    ["developer's", "developer"],
    ["looked up", "look up"],
  ];
  for (const [input, lemma] of regularCases) {
    const out = engine.translate(input, "en-zh");
    assert.match(out, new RegExp(`原形：${lemma}\\b`), `expected ${input} to resolve to ${lemma}, got:\n${out}`);
  }

  const irregularCases = [
    ["went", "go", /去|走/],
    ["children", "child", /小孩|儿童|孩子/],
    ["mice", "mouse", /鼠/],
    ["taught", "teach", /教/],
    ["better", "good", /好/],
    ["criteria", "criterion", /标准|准则/],
  ];
  for (const [input, lemma, meaning] of irregularCases) {
    const out = engine.translate(input, "auto");
    assert.match(out, new RegExp(`原形：${lemma}\\b`), `expected ${input} to note base ${lemma}, got:\n${out}`);
    assert.match(out, meaning);
  }

  const zhApple = engine.translate("苹果", "zh-en");
  assert.match(zhApple.split("\n")[0], /^apple\b/);

  const zhAsync = engine.translate("异步", "auto");
  assert.match(zhAsync, /\basynchronous\b/);

  const zhCache = engine.translate("缓存", "zh-en");
  assert.match(zhCache, /\bcache\b/);

  const unknownWord = engine.translate("xyzzyplugh", "en-zh");
  assert.match(unknownWord, /未在离线词典中找到/);
  assert.match(unknownWord, /No offline dictionary entry found/);

  const longEn = engine.translate(
    "The quick brown fox jumps over the lazy dog every single morning.",
    "en-zh",
  );
  assert.equal(longEn, LONG_SENTENCE_MESSAGE);

  const longZh = engine.translate(
    "今天我们打算把这个模块的异步事件循环重构得更加清晰。",
    "zh-en",
  );
  assert.equal(longZh, LONG_SENTENCE_MESSAGE);
});
