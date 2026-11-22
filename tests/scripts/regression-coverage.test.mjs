import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { COVERAGE_PARAMS, coverageRecorder, executedLines, flattenRanges, formatRanges, inlineMap, parseRanges, repoPath, wantsCoverage, WHOLE_FILE } from "../../scripts/regression/coverage.mjs";
import { decodeMappings, decodeVlq, mappedOffsets } from "../../scripts/regression/sourceMap.mjs";

const root = path.resolve("/repo");
const identityMap = (code) => ({ sources: ["x.ts"], mappings: code.split("\n").map((_, line) => (line === 0 ? "AAAA" : "AACA")).join(";") });

async function realCoverage(code, url) {
  const session = new Session();
  session.connect();
  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.startPreciseCoverage", COVERAGE_PARAMS);
    vm.runInThisContext(code, { filename: url });
    const { result } = await session.post("Profiler.takePreciseCoverage");
    await session.post("Profiler.stopPreciseCoverage");
    return result.find((script) => script.url === url);
  } finally {
    session.disconnect();
  }
}

test("VLQ and mappings decode to absolute source lines", () => {
  assert.deepEqual(decodeVlq("AAAA"), [0, 0, 0, 0]);
  assert.deepEqual(decodeVlq("gBAAD"), [16, 0, 0, -1]);
  assert.deepEqual(decodeMappings("AAAA,IAAI;;AACA"), [[[0, 0, 0], [4, 0, 0]], [], [[0, 0, 1]]]);
  assert.deepEqual(mappedOffsets("ab\ncd", { mappings: "AAAA;AACA,CAAC" }), [[0, 1], [3, 2], [4, 2]]);
});

test("innermost range decides whether an offset ran", () => {
  const functions = [{ ranges: [{ startOffset: 0, endOffset: 100, count: 1 }] }, { ranges: [{ startOffset: 10, endOffset: 50, count: 0 }, { startOffset: 20, endOffset: 30, count: 1 }] }];
  assert.deepEqual(flattenRanges(functions), [[0, 10, 1], [10, 20, 0], [20, 30, 1], [30, 50, 0], [50, 100, 1]]);
});

test("real V8 coverage marks the body of an uncalled function as not run and the called one as run", async () => {
  const code = ["const used = () => {", "  return 1;", "};", "function unused() {", "  return 2;", "}", "used();"].join("\n");
  const script = await realCoverage(code, "file:///coverage-probe.js");
  const lines = executedLines(mappedOffsets(code, identityMap(code)), script.functions);
  assert.ok(lines.has(2), "the called arrow's body ran");
  assert.ok(!lines.has(5), "the uncalled function's body did not run");
  assert.ok(lines.has(7), "top-level code ran");
});

test("Vite URLs map to repository paths and leave dependencies out", () => {
  assert.equal(repoPath("http://127.0.0.1:5173/src/i18n/index.ts?t=123", root), "src/i18n/index.ts");
  assert.equal(repoPath("http://127.0.0.1:5173/src/a%20b.css?import", root), "src/a b.css");
  assert.equal(repoPath("http://127.0.0.1:5173/tests/regression/timer.tsx", root), "tests/regression/timer.tsx");
  assert.equal(repoPath(`http://127.0.0.1:5173/@fs${path.join(root, "packages/plugin-base/src/index.mjs").split(path.sep).join("/").replace(/^([A-Za-z]:)/, "/$1")}`, root), "packages/plugin-base/src/index.mjs");
  assert.equal(repoPath("http://127.0.0.1:5173/node_modules/.vite/deps/react.js?v=1", root), null);
  assert.equal(repoPath("http://127.0.0.1:5173/@vite/client", root), null);
  assert.equal(repoPath("http://127.0.0.1:5173/packages/x/node_modules/y/index.js", root), null);
});

test("line ranges round-trip and the whole-file marker hits every line", () => {
  assert.equal(formatRanges(new Set([5, 1, 2, 3, 9])), "1-3,5,9");
  assert.deepEqual(parseRanges("1-3,5,9"), [[1, 3], [5, 5], [9, 9]]);
  assert.equal(parseRanges(WHOLE_FILE), WHOLE_FILE);
});

test("inline source maps are read from served code", () => {
  const map = { version: 3, sources: ["a.ts"], mappings: "AAAA" };
  const code = `export const a = 1;\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString("base64")}`;
  assert.deepEqual(inlineMap(code), map);
  assert.equal(inlineMap("export const a = 1;"), null);
});

test("only a full local run records coverage unless the environment says otherwise", () => {
  assert.equal(wantsCoverage({ words: [], shard: null, env: {} }), true);
  assert.equal(wantsCoverage({ words: ["settings"], shard: null, env: {} }), false);
  assert.equal(wantsCoverage({ words: [], shard: { index: 1, count: 3 }, env: {} }), false);
  assert.equal(wantsCoverage({ words: [], shard: null, env: { CI: "true" } }), false);
  assert.equal(wantsCoverage({ words: [], shard: null, env: { REGRESSION_COVERAGE: "0" } }), false);
  assert.equal(wantsCoverage({ words: ["x"], shard: null, env: { REGRESSION_COVERAGE: "1" } }), true);
});

test("the recorder writes only a clean tree whose HEAD did not move", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "coverage-table-"));
  try {
    const code = "export const a = 1;\nexport function f() {\n  return a;\n}";
    const served = { code, map: identityMap(code) };
    const session = { send: async (method) => (method === "Profiler.takePreciseCoverage" ? { result: [{ url: "http://h/src/a.ts?t=1", functions: [{ ranges: [{ startOffset: 0, endOffset: code.length, count: 1 }] }, { ranges: [{ startOffset: 20, endOffset: code.length, count: 0 }] }] }] } : {}) };
    let head = "a".repeat(40);
    const recorder = coverageRecorder({ root, load: async () => served, head: () => head });
    await recorder.finish(session, "a.html", true);
    await recorder.finish(session, "b.html", false);
    assert.deepEqual(Object.keys(recorder.pages), ["a.html"]);
    assert.deepEqual(recorder.pages["a.html"], { "src/a.ts": "1" });
    const file = path.join(dir, "table.json");
    assert.match(recorder.write({ file, dirty: " M src/a.ts", sha: head }), /not written/);
    assert.match(recorder.write({ file, dirty: "", sha: "b".repeat(40) }), /HEAD moved/);
    assert.match(recorder.write({ file, dirty: "", sha: head, now: new Date("2026-11-22T00:00:00Z") }), /1 pages written/);
    const table = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(table.sha, head);
    assert.equal(table.at, "2026-11-22T00:00:00.000Z");
    assert.deepEqual(table.mapped, { "src/a.ts": "1-4" });
    head = "c".repeat(40);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
