import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { aiFiles as installedAiFiles } from "../../fuyu-plugin/src/ai.mjs";
import { packageFiles } from "../../fuyu-plugin/src/pack.mjs";
import { validatePlugin } from "../../fuyu-plugin/src/validate.mjs";
import { nodeTest } from "../src/node-templates.mjs";
import { psText } from "../src/powershell-templates.mjs";
import { LANGUAGES, TEMPLATES, aiFiles, idProblem, normalizeOptions, scaffold } from "../src/scaffold.mjs";

const sdkPackage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fuyu-plugin");
const workDir = mkdtempSync(path.join(os.tmpdir(), "fuyu-scaffold-"));
after(() => rmSync(workDir, { recursive: true, force: true }));

function compile(dir) {
  const config = ts.getParsedCommandLineOfConfigFile(path.join(dir, "tsconfig.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  const program = ts.createProgram(config.fileNames, config.options);
  const result = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  return diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n"));
}

test("ids are checked like the island and the market do", () => {
  assert.equal(idProblem("me.plugin"), null);
  assert.match(idProblem("Me.Plugin"), /lowercase/);
  assert.match(idProblem("me..x"), /lowercase/);
  assert.match(idProblem("me.focusd-thing"), /focusd/);
  assert.match(idProblem("me.fuyu-thing"), /fuyu/);
  assert.throws(() => normalizeOptions({ language: "rust" }), /language must be/);
  assert.equal(normalizeOptions({ author: "Ann Lee" }).id, "ann-lee.my-plugin");
});

test("PowerShell text stays ASCII", () => {
  assert.equal(psText("It's"), "'It''s'");
  const chinese = psText("删除");
  assert.match(chinese, /^\(ConvertFrom-FuyuEscape '/);
  assert.ok([...chinese].every((char) => char.charCodeAt(0) < 128));
});

const runTest = (dir) =>
  new Promise((resolve) => {
    execFile(process.execPath, ["--test", "test/plugin.test.mjs"], { cwd: dir, encoding: "utf8", timeout: 60_000 }, (error, stdout, stderr) => resolve({ code: error ? (error.code ?? 1) : 0, output: `${stdout}
${stderr}` }));
  });

async function checkTemplate(language, template) {
  const id = `tester.${language}-${template}`;
  const dir = path.join(workDir, id);
  const { written } = scaffold({ dir, id, language, template, author: "Tester", nameEn: `Demo ${template}`, nameZh: "演示" });
  assert.ok(written.includes("fuyu-plugin.json") && written.includes(".github/workflows/plugin.yml"));
  if (language === "powershell") {
    assert.ok([...readFileSync(path.join(dir, "main.ps1"), "utf8")].every((char) => char.charCodeAt(0) < 128), "main.ps1 is ASCII");
    mkdirSync(path.join(dir, "test"));
    writeFileSync(path.join(dir, "test/plugin.test.mjs"), nodeTest(normalizeOptions({ id, language, template })));
  }
  if (language === "typescript") assert.deepEqual(compile(dir), []);

  const result = validatePlugin(dir);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);

  mkdirSync(path.join(dir, "node_modules"));
  symlinkSync(sdkPackage, path.join(dir, "node_modules/fuyu-plugin"), "junction");
  const run = await runTest(dir);
  assert.equal(run.code, 0, run.output);
}

test("every language and template validates and passes its own test", { concurrency: true }, async (t) => {
  const cases = LANGUAGES.flatMap((language) => TEMPLATES.map((template) => [language, template]));
  await Promise.all(
    cases.map(([language, template]) =>
      t.test(`${language} / ${template}`, { skip: language === "powershell" && process.platform !== "win32" }, () => checkTemplate(language, template)),
    ),
  );
});

test("new plugins carry the AI assistant skill, the same files fuyu-plugin skill installs, left out of the zip", () => {
  const dir = path.join(workDir, "tester.with-skill");
  const { written } = scaffold({ dir, id: "tester.with-skill", language: "javascript", template: "blank", author: "Tester" });
  const installed = installedAiFiles();
  assert.equal(aiFiles().size, installed.size);
  for (const [file, text] of installed) {
    assert.ok(written.includes(file), file);
    assert.equal(readFileSync(path.join(dir, file), "utf8").replaceAll("\r\n", "\n"), text, file);
  }
  const packed = packageFiles(dir).map(([name]) => name);
  assert.ok(!packed.some((name) => name.startsWith(".claude/") || name === "AGENTS.md"), packed.join(", "));
});
