import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GENERATED, SOURCES, listedMethods, markedMethods, problems, secretFields } from "../../scripts/plugins-v3/gen-rust-types.mjs";

function space({ rust, declarations, list }) {
  const root = mkdtempSync(join(tmpdir(), "fuyu-rust-types-"));
  mkdirSync(join(root, SOURCES, "app"), { recursive: true });
  for (const [name, text] of Object.entries(rust)) writeFileSync(join(root, SOURCES, name), text);
  if (declarations !== undefined) {
    mkdirSync(join(root, GENERATED), { recursive: true });
    writeFileSync(join(root, GENERATED, "rust.d.mts"), declarations);
    writeFileSync(join(root, GENERATED, "rust.mjs"), list);
  }
  return root;
}

const LIST = 'export const RUST_METHODS = Object.freeze([\n  "app.echo",\n  "app.version",\n]);\n';

test("marked methods are read from the source, with or without the crate path", () => {
  const source = '#[tauri::command]\n#[plugin_base::host_service("app.version")]\nfn a() {}\n#[host_service( "app.echo", timeout_ms = 5)]\nfn b() {}\n';
  assert.deepEqual(markedMethods([source]), ["app.echo", "app.version"]);
  assert.deepEqual(listedMethods(LIST), ["app.echo", "app.version"]);
});

test("generated text fields named like secrets are caught, in camelCase too, and flags about them are not", () => {
  assert.deepEqual(secretFields("export type A = { apiKey: string, hasSecret: boolean, text: string, sessionToken?: string | null, };"), ["apiKey", "sessionToken"]);
  assert.deepEqual(secretFields("export type A = { os: string, devBuild: boolean, };"), []);
});

test("a marked method missing from the generated list, or a stale one, is reported", () => {
  const root = space({
    rust: { "a.rs": '#[host_service("app.version")]\nfn a() {}\n', "app/b.rs": '#[host_service("app.new")]\nfn b() {}\n', "app/tests.rs": '#[host_service("test.only")]\nfn c() {}\n' },
    declarations: "export type RustMethods = {};\n",
    list: LIST,
  });
  try {
    const found = problems(root);
    assert.equal(found.length, 2);
    assert.match(found[0], /not generated: app\.new/);
    assert.match(found[1], /no longer marked: app\.echo/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("matching files pass, and missing ones say how to make them", () => {
  const ok = space({ rust: { "a.rs": '#[host_service("app.version")]\n#[host_service("app.echo")]\n' }, declarations: "export type RustMethods = {};\n", list: LIST });
  const empty = space({ rust: {} });
  try {
    assert.deepEqual(problems(ok), []);
    assert.match(problems(empty)[0], /run pnpm gen:rust-types/);
  } finally {
    rmSync(ok, { recursive: true, force: true });
    rmSync(empty, { recursive: true, force: true });
  }
});
