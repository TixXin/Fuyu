#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { isSecretName } from "../check-secret-fields.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const GENERATED = "packages/plugin-services/src/generated";
export const SOURCES = "src-tauri/src";
const MARK = /#\[\s*(?:plugin_base::)?host_service\s*\(\s*"([^"]+)"/g;
const TEST = "plugin_kernel::tests::the_generated_typescript_for_rust_methods_is_up_to_date";

function rustFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return rustFiles(path);
    return name.endsWith(".rs") && name !== "tests.rs" && !name.endsWith("_tests.rs") ? [path] : [];
  });
}

export function markedMethods(sources) {
  const names = sources.flatMap((text) => [...text.matchAll(MARK)].map((match) => match[1]));
  return [...new Set(names)].sort();
}

export function listedMethods(list) {
  return [...list.matchAll(/^\s*"([^"]+)",$/gm)].map((match) => match[1]).sort();
}

const snake = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

export function secretFields(declarations) {
  const fields = [...declarations.matchAll(/([A-Za-z_$][\w$]*)\??:\s*([^,;}]+)/g)].filter((match) => /\bstring\b|JsonValue/.test(match[2]));
  return [...new Set(fields.map((match) => match[1]))].filter((name) => isSecretName(snake(name))).sort();
}

export function problems(root = ROOT) {
  const dir = join(root, GENERATED);
  const declarationsPath = join(dir, "rust.d.mts");
  const listPath = join(dir, "rust.mjs");
  if (!existsSync(declarationsPath) || !existsSync(listPath)) return [`${GENERATED}/rust.d.mts and rust.mjs are missing; run pnpm gen:rust-types`];
  const found = [];
  const marked = markedMethods(rustFiles(join(root, SOURCES)).map((path) => readFileSync(path, "utf8")));
  const listed = listedMethods(readFileSync(listPath, "utf8"));
  const missing = marked.filter((name) => !listed.includes(name));
  const stale = listed.filter((name) => !marked.includes(name));
  if (missing.length) found.push(`marked with #[host_service] but not generated: ${missing.join(", ")}; run pnpm gen:rust-types`);
  if (stale.length) found.push(`generated but no longer marked: ${stale.join(", ")}; run pnpm gen:rust-types`);
  const secrets = secretFields(readFileSync(declarationsPath, "utf8"));
  if (secrets.length) found.push(`the generated types have fields that look like secrets (${secrets.join(", ")}); secrets do not leave Rust, see docs/architecture/plugins/v3-secrets.md`);
  return found;
}

function generate(root) {
  const env = { ...process.env, FUYU_WRITE_RUST_TYPES: "1", CARGO_TARGET_DIR: process.env.CARGO_TARGET_DIR ?? join("src-tauri", "target", "agents") };
  const args = ["heavy", "--label", "gen-rust-types", "--", "cargo", "test", "--manifest-path", join("src-tauri", "Cargo.toml"), "--lib", TEST];
  const run = spawnSync("pnpm", args, { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
  return run.status ?? 1;
}

function main() {
  const { values } = parseArgs({ options: { check: { type: "boolean", default: false } } });
  if (!values.check) {
    const status = generate(ROOT);
    if (status !== 0) process.exit(status);
  }
  const found = problems(ROOT);
  for (const problem of found) console.error(`[rust-types] ${problem}`);
  if (found.length) process.exit(1);
  console.log(`[rust-types] ${relative(ROOT, join(ROOT, GENERATED)).split(sep).join("/")} matches the #[host_service] functions`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
