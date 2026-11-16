import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = "src";
const EXEMPT = [/^src\/styles\/tokens\.css$/];
const DECLARATION = /(^|[;{\s])((?:transition|animation)(?:-duration|-timing-function)?)\s*:([^;{}]*)/g;
const KEYWORD = /(^|[\s,])(ease|ease-in|ease-out|ease-in-out)(?=[\s,]|$)/;
const TIME = /(^|[\s,])(\d*\.?\d+)(ms|s)(?=[\s,]|$)/;
const LOOP_MS = 1000;
const INSTANT_MS = 50;

function withoutVars(value) {
  let out = "";
  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (depth === 0 && value.startsWith("var(", i)) {
      depth = 1;
      i += 3;
      out += "var";
      continue;
    }
    if (depth > 0) {
      if (value[i] === "(") depth += 1;
      else if (value[i] === ")") depth -= 1;
      continue;
    }
    out += value[i];
  }
  return out;
}

function splitTop(value) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts;
}

function durationProblem(item, property) {
  const plain = item.trim();
  if (/(^|\s)infinite(\s|$)/.test(plain)) return null;
  const timeAt = plain.search(TIME);
  if (timeAt === -1) return null;
  const varAt = plain.search(/(^|\s)var(\s|$)/);
  if (!property.endsWith("-duration") && varAt !== -1 && varAt < timeAt) return null;
  const [, , number, unit] = plain.match(TIME);
  const ms = unit === "s" ? Number(number) * 1000 : Number(number);
  if (ms < INSTANT_MS || ms >= LOOP_MS) return null;
  return `${number}${unit}`;
}

export function motionLiterals(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const found = [];
  for (const match of code.matchAll(DECLARATION)) {
    const [, lead, property, rawValue] = match;
    const value = withoutVars(rawValue);
    const reasons = [];
    if (/cubic-bezier\(/.test(value)) reasons.push("cubic-bezier");
    if (KEYWORD.test(value)) reasons.push(value.match(KEYWORD)[2]);
    if (property === "transition" || property === "animation" || property.endsWith("-duration")) {
      for (const item of splitTop(value)) {
        const literal = durationProblem(item, property);
        if (literal) reasons.push(literal);
      }
    }
    if (reasons.length === 0) continue;
    const line = code.slice(0, match.index + lead.length).split("\n").length;
    found.push({ line, text: `${property}: ${rawValue.trim().replace(/\s+/g, " ")}`, reasons });
  }
  return found;
}

function cssFiles(dir, root) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...cssFiles(full, root));
    else if (entry.name.endsWith(".css")) files.push(relative(root, full).split(sep).join("/"));
  }
  return files;
}

export function compare(counts, allowlist) {
  const problems = [];
  for (const [file, count] of Object.entries(counts)) {
    const allowed = allowlist[file]?.count ?? 0;
    if (count > allowed) problems.push(`${file}: ${count} hard-coded motion value(s), ${allowed} allowed; use the --motion-* tokens (docs/design/motion.md)`);
    else if (count < allowed) problems.push(`${file}: now ${count} hard-coded motion value(s); lower its allowlist entry from ${allowed} (run with --update)`);
  }
  for (const [file, entry] of Object.entries(allowlist)) {
    if (!(file in counts) && entry.count > 0) problems.push(`${file}: no hard-coded motion values left; remove its allowlist entry (run with --update)`);
  }
  return problems;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const allowlistPath = join(root, "scripts", "motion-literal-allowlist.json");
  const allowlistFile = JSON.parse(readFileSync(allowlistPath, "utf8"));
  const counts = {};
  const details = {};
  for (const file of cssFiles(join(root, ROOT_DIR), root)) {
    if (EXEMPT.some((pattern) => pattern.test(file))) continue;
    const literals = motionLiterals(readFileSync(join(root, file), "utf8"));
    if (literals.length > 0) {
      counts[file] = literals.length;
      details[file] = literals;
    }
  }
  if (process.argv.includes("--update")) {
    const next = {};
    for (const [file, count] of Object.entries(counts)) {
      const entry = allowlistFile.files[file];
      if (entry && entry.count > 0) next[file] = { ...entry, count: Math.min(count, entry.count) };
    }
    allowlistFile.files = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(allowlistPath, `${JSON.stringify(allowlistFile, null, 2)}\n`);
  }
  if (process.argv.includes("--list")) {
    for (const [file, literals] of Object.entries(details)) {
      for (const { line, text, reasons } of literals) console.log(`${file}:${line}  [${reasons.join(", ")}]  ${text}`);
    }
    return 0;
  }
  const problems = compare(counts, allowlistFile.files);
  for (const problem of problems) {
    console.error(`[check:motion] ${problem}`);
    const file = problem.split(":")[0];
    for (const { line, text } of (details[file] ?? []).slice(0, 8)) console.error(`    ${file}:${line}  ${text}`);
  }
  if (problems.length === 0) console.log(`[check:motion] ${Object.keys(counts).length} allowlisted file(s); no new hard-coded curves or off-tier durations.`);
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main();
}
