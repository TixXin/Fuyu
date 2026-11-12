// Keeps colours that only suit a dark island out of the CSS. A colour written as a literal
// (#fff, rgba(255, 255, 255, 0.6), white) in a text, fill or border property shows the same on
// a light island, where it is often unreadable. Write it as a token with the old value as the
// fallback instead: var(--error-text, #ff9aa9), or rgba(var(--overlay-rgb, 255, 255, 255), 0.6)
// for a neutral; .island-light (src/styles/tokens.css) supplies the light values.
//
// Allowed as they are: token definitions (--name: value), fallbacks inside var(), rules for a
// light island (a selector with island-light or --light), tokens.css, and windows that are dark
// whatever the theme (the screenshot overlay). Files that already had literals are listed in
// color-literal-allowlist.json with their count, which may only go down.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = "src";
const EXEMPT = [/^src\/styles\/tokens\.css$/, /^src\/windows\/screenshot\//, /^src\/features\/screenshot\//];
const PROPERTY = /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke|caret-color|text-decoration-color|column-rule-color)$/;
const LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(\s*[0-9.]+\s*[, ]\s*[0-9.]+|\bhsla?\(\s*[0-9.]+|\b(white|black)\b/gi;

/** `value` with every var(...) call removed, so fallbacks inside them do not count. */
function withoutVars(value) {
  let out = "";
  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (depth === 0 && value.startsWith("var(", i)) {
      depth = 1;
      i += 3;
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

/** The literal colours in a stylesheet that would look the same on a light island: [{ line, text }]. */
export function colorLiterals(source) {
  const found = [];
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const selectors = [];
  let selector = "";
  let line = 1;
  let declaration = "";
  let declarationLine = 1;
  const flush = () => {
    const match = declaration.match(/^\s*([a-z-]+)\s*:([\s\S]*)$/i);
    declaration = "";
    if (!match || match[1].startsWith("--") || !PROPERTY.test(match[1].toLowerCase())) return;
    if (selectors.some((s) => /island-light|--light\b/.test(s))) return;
    const literals = withoutVars(match[2]).match(LITERAL);
    if (literals) found.push({ line: declarationLine, text: `${match[1].trim()}: ${match[2].trim()}` });
  };
  for (const char of code) {
    if (char === "{") {
      selectors.push(selector.trim());
      selector = "";
      declaration = "";
    } else if (char === "}") {
      flush();
      selectors.pop();
      selector = "";
    } else if (char === ";") {
      if (selectors.length > 0) flush();
      selector = "";
    } else if (selectors.length > 0) {
      if (!declaration.trim()) declarationLine = line;
      declaration += char;
      selector += char;
    } else {
      selector += char;
    }
    if (char === "\n") line += 1;
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

/** Problems with `counts` (path → literals) against `allowlist` (path → allowed count). */
export function compare(counts, allowlist) {
  const problems = [];
  for (const [file, count] of Object.entries(counts)) {
    const allowed = allowlist[file] ?? 0;
    if (count > allowed) problems.push(`${file}: ${count} dark-only colour literal(s), ${allowed} allowed`);
    else if (count < allowed) problems.push(`${file}: now ${count} literal(s); lower its allowlist entry from ${allowed} (run with --update)`);
  }
  for (const [file, allowed] of Object.entries(allowlist)) {
    if (!(file in counts) && allowed > 0) problems.push(`${file}: no literals left; remove its allowlist entry (run with --update)`);
  }
  return problems;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const allowlistPath = join(root, "scripts", "color-literal-allowlist.json");
  const allowlistFile = JSON.parse(readFileSync(allowlistPath, "utf8"));
  const counts = {};
  const details = {};
  for (const file of cssFiles(join(root, ROOT_DIR), root)) {
    if (EXEMPT.some((pattern) => pattern.test(file))) continue;
    const literals = colorLiterals(readFileSync(join(root, file), "utf8"));
    if (literals.length > 0) {
      counts[file] = literals.length;
      details[file] = literals;
    }
  }
  if (process.argv.includes("--update")) {
    // Only ever lowers entries (or drops them); a file that grew still fails below.
    const next = {};
    for (const [file, count] of Object.entries(counts)) {
      const allowed = allowlistFile.files[file] ?? 0;
      if (allowed > 0) next[file] = Math.min(count, allowed);
    }
    allowlistFile.files = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(allowlistPath, `${JSON.stringify(allowlistFile, null, 2)}\n`);
  }
  const problems = compare(counts, allowlistFile.files);
  for (const problem of problems) {
    console.error(`[check:colors] ${problem}`);
    const file = problem.split(":")[0];
    for (const { line, text } of (details[file] ?? []).slice(0, 8)) console.error(`    ${file}:${line}  ${text}`);
  }
  if (problems.length === 0) console.log(`[check:colors] ${Object.keys(counts).length} allowlisted file(s); no new dark-only colour literals.`);
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main();
}
