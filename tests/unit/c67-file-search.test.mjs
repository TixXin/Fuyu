import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { classifyEs, esCandidates, findEverythingExe } from "../../plugins/v3/official/file-search/src/everything.ts";
import { esArgs, mdfindArgs, normalizeQuery, openSpec, splitPath, toHits } from "../../plugins/v3/official/file-search/src/model.ts";
import { runLines } from "../../plugins/v3/official/file-search/src/runLines.ts";

const outcome = (patch) => ({ lines: [], code: 0, missing: false, timedOut: false, truncated: false, stderr: "", ...patch });

function fakeHost(files, env) {
  const set = new Set(files);
  return { env, exists: (path) => set.has(path) };
}

const schedule = (callback, ms) => {
  const timer = setTimeout(callback, ms);
  return () => clearTimeout(timer);
};

test("C67 es.exe outcomes map to the right notice", () => {
  const exe = "C:/Program Files/Everything/Everything.exe";
  assert.equal(classifyEs("a", outcome({ missing: true, code: null }), null).status, "no-everything");
  assert.equal(classifyEs("a", outcome({ missing: true, code: null }), exe).status, "no-es");
  const notRunning = classifyEs("a", outcome({ code: 8 }), exe);
  assert.equal(notRunning.status, "not-running");
  assert.equal(notRunning.canStart, true);
  assert.equal(classifyEs("a", outcome({ code: 8 }), null).canStart, false);
  assert.equal(classifyEs("a", outcome({ code: 3, stderr: "bad switch" }), exe).status, "error");

  const lines = Array.from({ length: 51 }, (_, i) => `D:\\docs\\report ${i}.docx\r`);
  const ok = classifyEs("report", outcome({ lines }), exe);
  assert.equal(ok.status, "ok");
  assert.equal(ok.hits.length, 50);
  assert.equal(ok.truncated, true);
  assert.deepEqual(ok.hits[0], { path: "D:\\docs\\report 0.docx", name: "report 0.docx", folder: "D:\\docs" });
});

test("C67 user text never becomes an es.exe switch", () => {
  const args = esArgs(normalizeQuery("  -export-csv out.csv\n/x report "));
  assert.deepEqual(args.slice(0, 4), ["-n", "51", "-cp", "65001"]);
  assert.deepEqual(args.slice(4), ["export-csv", "out.csv", "x", "report"]);
  assert.deepEqual(mdfindArgs("报告", "/Users/me"), ["-onlyin", "/Users/me", "-name", "报告"]);
});

test("C67 open and reveal use the platform file manager", () => {
  assert.deepEqual(openSpec("C:\\a b\\c.txt", "win32", true), { command: "explorer.exe", args: ["/select,C:\\a b\\c.txt"] });
  assert.deepEqual(openSpec("C:\\a b\\c.txt", "win32", false), { command: "explorer.exe", args: ["C:\\a b\\c.txt"] });
  assert.deepEqual(openSpec("/Users/me/c.txt", "darwin", true), { command: "open", args: ["-R", "/Users/me/c.txt"] });
  assert.equal(openSpec("/x", "linux", false), null);
  assert.deepEqual(splitPath("/Users/me/notes/", "darwin"), { name: "notes", folder: "/Users/me" });
  assert.deepEqual(splitPath("/a.txt", "darwin"), { name: "a.txt", folder: "/" });
  assert.deepEqual(toHits(["/a", "/a", "", "/b"], "darwin").map((hit) => hit.path), ["/a", "/b"]);
});

test("C67 finds Everything and es.exe where Everything and winget install them", () => {
  const programFiles = "PF";
  const local = "LA";
  const exe15 = join(programFiles, "Everything 1.5a", "Everything64.exe");
  const env = { ProgramFiles: programFiles, LOCALAPPDATA: local };
  assert.equal(findEverythingExe(fakeHost([], env)), null);
  assert.equal(findEverythingExe(fakeHost([exe15], env)), exe15);

  const besideExe = join(programFiles, "Everything 1.5a", "es.exe");
  const winget = join(local, "Microsoft", "WinGet", "Links", "es.exe");
  assert.deepEqual(esCandidates(exe15, fakeHost([besideExe, winget], env)), [besideExe, winget, "es.exe"]);
  assert.deepEqual(esCandidates(null, fakeHost([], env)), ["es.exe"]);
});

test("C67 runLines stops a chatty search at the limit and reports a missing program", async () => {
  const chatty = await runLines(process.execPath, ["-e", "for (let i = 0; i < 100000; i++) console.log('/f/' + i)"], {
    maxLines: 5,
    timeoutMs: 10000,
    schedule,
  });
  assert.equal(chatty.missing, false);
  assert.equal(chatty.truncated, true);
  assert.equal(chatty.timedOut, false);
  assert.deepEqual(chatty.lines.map((line) => line.trim()), ["/f/0", "/f/1", "/f/2", "/f/3", "/f/4"]);

  const missing = await runLines("fuyu-no-such-program-c67", [], { maxLines: 5, timeoutMs: 5000, schedule });
  assert.equal(missing.missing, true);
});
