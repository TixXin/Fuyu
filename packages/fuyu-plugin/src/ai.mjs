import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IGNORE_FILE, LEGACY_IGNORE_FILE } from "./ignore.mjs";

const AI_DIR = fileURLToPath(new URL("../ai/", import.meta.url));
export const SKILL_DIR = ".claude/skills/fuyu-plugin";
export const AI_IGNORE_LINES = [".claude/", "AGENTS.md"];

const lf = (text) => text.replaceAll("\r\n", "\n");

function walk(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]));
}

export function aiFiles(aiDir = AI_DIR) {
  const files = new Map();
  for (const name of walk(path.join(aiDir, "skill"))) files.set(`${SKILL_DIR}/${name}`, lf(readFileSync(path.join(aiDir, "skill", name), "utf8")));
  files.set("AGENTS.md", lf(readFileSync(path.join(aiDir, "AGENTS.md"), "utf8")));
  return files;
}

function ignoreAiFiles(dir) {
  const name = existsSync(path.join(dir, IGNORE_FILE)) || !existsSync(path.join(dir, LEGACY_IGNORE_FILE)) ? IGNORE_FILE : LEGACY_IGNORE_FILE;
  const file = path.join(dir, name);
  const text = existsSync(file) ? lf(readFileSync(file, "utf8")) : "";
  const present = new Set(text.split("\n").map((line) => line.trim()));
  const missing = AI_IGNORE_LINES.filter((line) => !present.has(line));
  if (missing.length === 0) return null;
  const head = text === "" ? "# Left out of the plugin's zip (fuyu-plugin pack).\n" : text.endsWith("\n") ? text : `${text}\n`;
  writeFileSync(file, `${head}${missing.join("\n")}\n`);
  return name;
}

export function installAi(dir, { force = false, aiDir = AI_DIR } = {}) {
  const results = [];
  for (const [relative, text] of aiFiles(aiDir)) {
    const target = path.join(dir, relative);
    if (existsSync(target)) {
      if (lf(readFileSync(target, "utf8")) === text) {
        results.push({ file: relative, result: "unchanged" });
        continue;
      }
      if (!force) {
        results.push({ file: relative, result: "kept" });
        continue;
      }
    }
    const existed = existsSync(target);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
    results.push({ file: relative, result: existed ? "updated" : "added" });
  }
  return { results, ignoreFile: ignoreAiFiles(dir) };
}
