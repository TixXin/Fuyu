import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SCAN_ROOTS = ["src", "packages", "plugins/v3", "scripts", "tests"];

const SKIPPED_DIRECTORIES = new Set(["node_modules", "target", "gen", "dist"]);
const CLOSER_OF = { "(": ")", "[": "]", "{": "}" };
const OPENER_OF = { ")": "(", "]": "[", "}": "{" };

function positionAt(source, index) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === "\n") {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: index - lineStart + 1 };
}

function problemAt(source, index, message) {
  return { ...positionAt(source, index), message };
}

function where(source, index) {
  const { line, column } = positionAt(source, index);
  return `${line}:${column}`;
}

function stringEnd(source, start) {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i += 1) {
    const char = source[i];
    if (char === "\\") i += source[i + 1] === "\r" && source[i + 2] === "\n" ? 2 : 1;
    else if (char === quote) return i;
    else if (char === "\n") return -1;
  }
  return -1;
}

function bareUrlEnd(source, open) {
  let start = open + 1;
  while (/\s/.test(source[start] ?? "")) start += 1;
  if (source[start] === '"' || source[start] === "'") return -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "\\") i += 1;
    else if (source[i] === ")") return i;
  }
  return -1;
}

export function cssSyntaxProblems(source) {
  const stack = [];
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === "\\") {
      i += 1;
    } else if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) return [problemAt(source, i, "this comment is never closed")];
      i = end + 1;
    } else if (char === '"' || char === "'") {
      const end = stringEnd(source, i);
      if (end < 0) return [problemAt(source, i, "this string is never closed on its line")];
      i = end;
    } else if (char === "(" && /url$/i.test(source.slice(Math.max(0, i - 3), i)) && bareUrlEnd(source, i) >= 0) {
      i = bareUrlEnd(source, i);
    } else if (char === "(" || char === "[") {
      stack.push({ char, index: i });
    } else if (char === "{") {
      const top = stack[stack.length - 1];
      if (top && top.char !== "{") {
        return [problemAt(source, top.index, `this "${top.char}" has no "${CLOSER_OF[top.char]}" before the "{" at ${where(source, i)}`)];
      }
      stack.push({ char, index: i });
    } else if (char === ")" || char === "]" || char === "}") {
      const top = stack[stack.length - 1];
      if (!top) return [problemAt(source, i, `this "${char}" closes nothing`)];
      if (top.char !== OPENER_OF[char]) {
        return [problemAt(source, top.index, `this "${top.char}" has no "${CLOSER_OF[top.char]}" before the "${char}" at ${where(source, i)}`)];
      }
      stack.pop();
    }
  }
  if (stack.length === 0) return [];
  const open = stack[stack.length - 1];
  return [problemAt(source, open.index, `this "${open.char}" has no "${CLOSER_OF[open.char]}" before the end of the file`)];
}

function cssFiles(dir, root) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...cssFiles(full, root));
    } else if (entry.name.endsWith(".css")) {
      files.push(relative(root, full).split(sep).join("/"));
    }
  }
  return files;
}

export function checkCssSyntax(root) {
  const problems = [];
  let checked = 0;
  for (const scanRoot of SCAN_ROOTS) {
    if (!existsSync(join(root, scanRoot))) continue;
    for (const file of cssFiles(join(root, scanRoot), root)) {
      checked += 1;
      for (const { line, column, message } of cssSyntaxProblems(readFileSync(join(root, file), "utf8"))) {
        problems.push(`${file}:${line}:${column}  ${message}`);
      }
    }
  }
  return { checked, problems };
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const { checked, problems } = checkCssSyntax(root);
  for (const problem of problems) console.error(`[check:css] ${problem}`);
  if (problems.length > 0) {
    console.error("[check:css] a stylesheet with unbalanced brackets drops every rule after the break once it is bundled; fix the bracket.");
    return 1;
  }
  console.log(`[check:css] ${checked} stylesheet(s); brackets, strings and comments are balanced.`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main();
}
