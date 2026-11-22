import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinsOffReached, featureOfFile, isBuiltinsOffPage } from "./regression/builtins-off-pages.mjs";
import { PAGES } from "./run-regression.mjs";
import { selectByCoverage } from "./regression/coverageSelect.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPECIFIER = /\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|@import\s+["']([^"']+)["']/g;
const EXTENSIONS = ["", ".ts", ".tsx", ".mjs", ".js", ".json", ".css", "/index.ts", "/index.tsx", "/index.mjs"];
const SOURCE = /\.(tsx?|mjs|js|css)$/;
const WINDOWS = process.platform === "win32";
const REGRESSION_JOBS = 3;

const rel = (root, file) => path.relative(root, file).split(path.sep).join("/");

export function specifiers(text) {
  return [...text.matchAll(SPECIFIER)].map((match) => match.slice(1).find(Boolean)).filter(Boolean);
}

export function resolveImport(from, specifier, root, exists = existsSync) {
  const bare = specifier.split("?")[0];
  const base = bare.startsWith("/") ? path.join(root, bare) : bare.startsWith(".") ? path.resolve(path.dirname(from), bare) : null;
  if (!base) return null;
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (exists(candidate) && (extension || SOURCE.test(candidate))) return candidate;
  }
  return null;
}

export function closure(entry, root, read = (file) => readFileSync(file, "utf8"), exists = existsSync, cache = new Map()) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!SOURCE.test(file)) continue;
    if (!cache.has(file)) {
      let text = "";
      try {
        text = read(file);
      } catch {
        text = "";
      }
      cache.set(file, specifiers(text).map((specifier) => resolveImport(file, specifier, root, exists)).filter(Boolean));
    }
    for (const next of cache.get(file)) if (!seen.has(next)) queue.push(next);
  }
  return new Set([...seen].map((file) => rel(root, file)));
}

export function pageEntry(page, root, read = (file) => readFileSync(file, "utf8")) {
  const html = path.join(root, "tests", "regression", page.split("?")[0]);
  const src = read(html).match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
  if (!src) return null;
  return src.startsWith("/") ? path.join(root, src.slice(1)) : path.resolve(path.dirname(html), src);
}

export function rustFilters(changed) {
  const rust = changed.filter((file) => file.startsWith("src-tauri/"));
  if (!rust.length) return null;
  if (rust.some((file) => !/^src-tauri\/src\/.+\.rs$/.test(file))) return [];
  const modules = new Set();
  for (const file of rust) {
    const [first] = file.slice("src-tauri/src/".length).split("/");
    const name = first.replace(/\.rs$/, "");
    if (name === "lib" || name === "main") return [];
    modules.add(`${name}::`);
  }
  return [...modules].sort();
}

export function select({ changed, pages, unitTests, root, read = (file) => readFileSync(file, "utf8"), exists = existsSync }) {
  const cache = new Map();
  const touched = new Set(changed);
  const hits = (deps) => [...deps].some((file) => touched.has(file));
  const selectedPages = pages.filter((page) => {
    const entry = pageEntry(page, root, read);
    if (!entry) return false;
    if (touched.has(rel(root, path.join(root, "tests", "regression", page.split("?")[0])))) return true;
    const deps = closure(entry, root, read, exists, cache);
    if (!isBuiltinsOffPage(page)) return hits(deps);
    return builtinsOffReached(page, changed.filter((file) => deps.has(file) || featureOfFile(file)));
  });
  const selectedTests = unitTests.filter((test) => {
    if (touched.has(rel(root, test))) return true;
    if (hits(closure(test, root, read, exists, cache))) return true;
    let text = "";
    try {
      text = read(test);
    } catch {
      return false;
    }
    return changed.some((file) => text.includes(file));
  });
  return { pages: selectedPages, tests: selectedTests.map((test) => rel(root, test)), rust: rustFilters(changed) };
}

function testFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : testFiles(full);
    return name.endsWith(".test.mjs") ? [full] : [];
  });
}

function changedFiles(since) {
  const run = (args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  return [...new Set([
    ...(since ? run(["diff", "--name-only", `${since}...HEAD`]) : []),
    ...run(["diff", "--name-only", "HEAD"]),
    ...run(["ls-files", "--others", "--exclude-standard"]),
  ])];
}

const pageWord = (page) => (isBuiltinsOffPage(page) ? page : page.split("?")[0]);

function main(args) {
  const at = args.indexOf("--since");
  const since = at >= 0 ? args[at + 1] : null;
  const dryRun = args.includes("--dry-run");
  const explicit = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--since");
  const changed = explicit.length ? explicit : changedFiles(since);
  if (!changed.length) {
    console.log("[test:changed] 没有改动（没提交的和 --since 之后的都没有）。");
    return 0;
  }
  const unitTests = [path.join(ROOT, "tests", "unit"), path.join(ROOT, "tests", "scripts"), ...readdirSync(path.join(ROOT, "packages")).map((name) => path.join(ROOT, "packages", name, "test"))].flatMap(testFiles);
  const picked = select({ changed, pages: PAGES, unitTests, root: ROOT });
  const byCoverage = args.includes("--by-imports")
    ? { pages: null, note: "--by-imports，按 import 关系挑页" }
    : selectByCoverage({ root: ROOT, changed, pages: PAGES, importPages: (pages, files) => select({ changed: files, pages, unitTests: [], root: ROOT }).pages, entryOf: (page) => pageEntry(page, ROOT) });
  const { tests, rust } = picked;
  const pages = byCoverage.pages ?? picked.pages;
  console.log(`[test:changed] ${byCoverage.note}${byCoverage.pages ? `：${pages.length} 页，按 import 关系是 ${picked.pages.length} 页` : ""}`);
  console.log(`[test:changed] ${changed.length} 个改动的文件 → 回归页 ${pages.length} 页、单元测试 ${tests.length} 个文件${rust ? `、Rust ${rust.length ? rust.join(" ") : "整个 lib"}` : ""}`);
  for (const page of pages) console.log(`  页  ${page}`);
  for (const test of tests) console.log(`  测  ${test}`);
  if (dryRun) return 0;
  let code = 0;
  if (tests.length) code ||= spawnSync(process.execPath, ["--test", ...tests], { cwd: ROOT, stdio: "inherit" }).status ?? 1;
  if (pages.length) code ||= spawnSync("pnpm", ["test:regression", "--jobs", String(Math.min(REGRESSION_JOBS, pages.length)), ...pages.map(pageWord)], { cwd: ROOT, shell: WINDOWS, stdio: "inherit" }).status ?? 1;
  if (rust) code ||= spawnSync("pnpm", ["heavy", "--label", "test:changed", "--", "cargo", "test", "--manifest-path", "src-tauri/Cargo.toml", "--lib", "--", ...rust], { cwd: ROOT, shell: WINDOWS, stdio: "inherit" }).status ?? 1;
  console.log(code ? "\n[test:changed] 有没过的，见上面。" : "\n✓ [test:changed] 改到的部分都过了（全量等推 PR 时 pnpm mq:verify）。");
  return code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
