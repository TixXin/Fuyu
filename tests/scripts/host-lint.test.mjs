import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd: root });

const lint = async (code, filePath) => {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map(({ ruleId, line }) => `${line}:${ruleId}`);
};

const hostPaths = ["src/features/timer/host/probe.mjs", "src/features/notes/host/index.mjs", "src/features/timer/host/probe.ts", "packages/plugin-base/src/host/probe.mjs"];

const violations = [
  'import { invoke } from "@tauri-apps/api/core";',
  'import { open } from "@tauri-apps/plugin-dialog";',
  'import { useState } from "react";',
  'import { createRoot } from "react-dom/client";',
  'import { Timer } from "lucide-react";',
  'import DOMPurify from "dompurify";',
  'import { listTimers } from "../api.ts";',
  'import { listTimers } from "../api";',
  'import { TimerRow } from "../TimerRow.tsx";',
  'import "../timer.css";',
  'import { readStorage } from "../../../lib/storage.ts";',
  'import { Button } from "../../../components/Button.ts";',
  'import { mount } from "@fuyu/plugin-base/client";',
  'const core = await import("@tauri-apps/api/core");',
  'const api = await import("../api.ts");',
  "window.addEventListener('focus', () => {});",
  "document.title = 'x';",
  "localStorage.getItem('k');",
  "sessionStorage.clear();",
].join("\n");

test("browser imports and globals in host code are errors", async () => {
  const expected = violations.split("\n").map((line, index) => `${index + 1}:${line.includes("import(") ? "no-restricted-syntax" : line.startsWith("import") ? "no-restricted-imports" : "no-restricted-globals"}`);
  for (const filePath of hostPaths) {
    assert.deepEqual(await lint(violations, filePath), expected, filePath);
  }
});

test("node modules, the base and pure domain functions are allowed in host code", async () => {
  const code = [
    'import { readFile } from "node:fs/promises";',
    'import { Context } from "cordis";',
    'import { defineService } from "@fuyu/plugin-base/services";',
    'import { HOST_SHARED_MODULES } from "@fuyu/plugin-base/protocol";',
    'import { MAX_TIMERS } from "../timers.ts";',
    'import { rules } from "./rules.mjs";',
    'import { clients } from "./clients.mjs";',
    'const fs = await import("node:fs");',
    "export const ready = [readFile, Context, defineService, HOST_SHARED_MODULES, MAX_TIMERS, rules, clients, fs, globalThis.process];",
  ].join("\n");
  for (const filePath of hostPaths) {
    assert.deepEqual(await lint(code, filePath), [], filePath);
  }
});

test("code outside host/ keeps the browser rules only", async () => {
  const code = 'import { useState } from "react";\nimport { readStorage } from "../../lib/storage.ts";\nexport const x = [useState, readStorage, window.innerWidth];';
  assert.deepEqual(await lint(code, "src/features/timer/TimerPanel.tsx"), []);
  assert.deepEqual(await lint(code, "packages/plugin-base/src/client/probe.mjs"), []);
});

test("pnpm lint covers the plugin base host", () => {
  const { scripts } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.match(scripts.lint, /(^|\s)src(\s|$)/);
  assert.match(scripts.lint, /packages\/plugin-base\/src\/host/);
});
