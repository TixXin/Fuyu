import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { packNpmSdk } from "../../scripts/plugins-v3/pack-npm-sdk.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CREATE_PKG_MODULES = join(REPO_ROOT, "packages", "create-plugin", "node_modules");
const CLI_PKG_MODULES = join(REPO_ROOT, "packages", "plugin-cli", "node_modules");
const BASE_PKG_MODULES = join(REPO_ROOT, "packages", "plugin-base", "node_modules");

const scratch = mkdtempSync(join(tmpdir(), "fuyu-npm-sdk-e2e-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function linkDir(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(realpathSync(source), target, "junction");
}

function runNode(cwd, script, args = [], env = {}) {
  const res = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, output: `${res.stdout}${res.stderr}` };
}

const SDK_TYPE_PROBE = `import {
  Service,
  build,
  check,
  defineService,
  isServiceDefinition,
  pack,
  type Context,
} from "fuyu-plugin";
import { startHost } from "fuyu-plugin/host";
import { SLOTS, SLOT_THEME } from "fuyu-plugin/protocol";
import {
  commandsV1,
  marketV1,
  pluginConfigV1,
  timersV1,
  todosV1,
} from "fuyu-plugin/services";

const customV1 = defineService<{ ping(x: { ok: boolean }): { pong: boolean } }>("custom.demo/v1", {
  methods: { ping: true },
});

export function verifyTypes(ctx: Context) {
  const dir: string = ctx.dataDir;
  const off1 = ctx.setTimeout(() => {}, 100);
  const off2 = ctx.setInterval(() => {}, 1000);
  const slept: Promise<void> = ctx.sleep(10);
  const timerClient = ctx.services.get(timersV1);
  const todoClient = ctx.services.get(todosV1);
  const cmdClient = ctx.services.get(commandsV1);
  const cfgClient = ctx.services.get(pluginConfigV1);
  const marketClient = ctx.services.get(marketV1);
  const customClient = ctx.services.get(customV1);
  ctx.clients.publish("tick", { dir });
  ctx.commands.register("ping", () => ({ ok: true }));
  const cfg = ctx.config.get<{ count: number }>();
  const fetched = ctx.http.fetch("https://example.com");
  const wins = ctx.windows.list();
  const hostCall = ctx.host.call("list");
  const hostOff = ctx.host.on("timers", () => {});
  const slotOff = ctx.slots.add("island.page/v1", { id: "x", component: () => null });
  return {
    Service,
    build,
    check,
    pack,
    isServiceDefinition,
    startHost,
    SLOTS,
    SLOT_THEME,
    off1,
    off2,
    slept,
    timerClient,
    todoClient,
    cmdClient,
    cfgClient,
    marketClient,
    customClient,
    cfg,
    fetched,
    wins,
    hostCall,
    hostOff,
    slotOff,
  };
}
`;

const TIMERS_PROVIDER_STUB = `export const name = "timers-stub";
export function apply(ctx) {
  const timersV1 = {
    name: "timers/v1",
    methods: { list: {}, start: {}, pause: {}, resume: {}, extend: {}, remove: {}, dismissRinging: {} },
    events: { changed: {}, due: {} },
  };
  ctx.services.provide(timersV1, {
    list: () => ({ timers: [], at: Date.now() }),
    start: () => ({ timer: null }),
    pause: () => ({}),
    resume: () => ({}),
    extend: () => ({}),
    remove: () => ({ removed: false }),
    dismissRinging: () => ({ removed: 0 }),
  });
}
`;

test("packNpmSdk builds standalone fuyu-plugin and create-fuyu-plugin 2.0.0 that scaffold, typecheck, lint, check, pack and run in tmpdir", async () => {
  const sdkOut = join(scratch, "sdk-out");
  const packed = await packNpmSdk({ outDir: sdkOut, version: "2.0.0" });

  const fuyuRaw = readFileSync(join(packed.fuyuDir, "package.json"), "utf8");
  const createRaw = readFileSync(join(packed.createDir, "package.json"), "utf8");
  assert.doesNotMatch(fuyuRaw, /workspace:/);
  assert.doesNotMatch(createRaw, /workspace:/);

  const fuyuPkg = JSON.parse(fuyuRaw);
  const createPkg = JSON.parse(createRaw);
  assert.equal(fuyuPkg.private, undefined);
  assert.equal(createPkg.private, undefined);
  assert.equal(fuyuPkg.name, "fuyu-plugin");
  assert.equal(createPkg.name, "create-fuyu-plugin");
  assert.equal(fuyuPkg.version, "2.0.0");
  assert.equal(createPkg.version, "2.0.0");
  assert.equal(fuyuPkg.license, "MIT");
  assert.equal(createPkg.license, "MIT");
  assert.deepEqual(fuyuPkg.repository, {
    type: "git",
    url: "git+https://github.com/TixXin/fuyu.git",
    directory: "packages/plugin-cli",
  });
  assert.deepEqual(createPkg.repository, {
    type: "git",
    url: "git+https://github.com/TixXin/fuyu.git",
    directory: "packages/create-plugin",
  });
  assert.deepEqual(Object.keys(fuyuPkg.dependencies).sort(), ["esbuild", "react", "react-dom", "ws"]);
  assert.ok(fuyuPkg.files.includes("LICENSE-lucide"));
  assert.match(readFileSync(join(packed.fuyuDir, "LICENSE-lucide"), "utf8"), /^ISC License\s+Copyright \(c\) \d+ Lucide Icons and Contributors/);
  assert.equal(createPkg.dependencies, undefined);
  assert.ok(existsSync(join(packed.fuyuDir, "LICENSE")));
  assert.ok(existsSync(join(packed.fuyuDir, "README.md")));
  assert.ok(existsSync(join(packed.createDir, "LICENSE")));
  assert.ok(existsSync(join(packed.createDir, "README.md")));

  const externalWorkspace = join(scratch, "external-author");
  mkdirSync(externalWorkspace, { recursive: true });
  const createRes = runNode(externalWorkspace, join(packed.createDir, "bin", "create-fuyu-plugin.mjs"), [
    "ext-timer",
    "--yes",
    "--owner",
    "SomeOne",
    "--name",
    "ext-timer",
    "--display-name",
    "Ext Timer",
    "--display-name-zh",
    "外部计时器",
  ]);
  assert.equal(createRes.status, 0, createRes.output);

  const projectDir = join(externalWorkspace, "ext-timer");
  const generatedPkgRaw = readFileSync(join(projectDir, "package.json"), "utf8");
  const generatedPkg = JSON.parse(generatedPkgRaw);
  assert.equal(generatedPkg.devDependencies["fuyu-plugin"], "^2.0.0");
  assert.doesNotMatch(generatedPkgRaw, /@fuyu\/|file:/);
  assert.match(readFileSync(join(projectDir, "src", "host.ts"), "utf8"), /from "fuyu-plugin"/);
  assert.match(readFileSync(join(projectDir, "src", "host.ts"), "utf8"), /from "fuyu-plugin\/services"/);
  assert.match(readFileSync(join(projectDir, "src", "island.tsx"), "utf8"), /from "fuyu-plugin"/);

  cpSync(packed.fuyuDir, join(projectDir, "node_modules", "fuyu-plugin"), { recursive: true });
  linkDir(join(CLI_PKG_MODULES, "esbuild"), join(projectDir, "node_modules", "esbuild"));
  linkDir(join(BASE_PKG_MODULES, "ws"), join(projectDir, "node_modules", "ws"));
  for (const tool of ["@types/react", "eslint", "typescript", "typescript-eslint"]) {
    linkDir(join(CREATE_PKG_MODULES, tool), join(projectDir, "node_modules", tool));
  }

  const probeFile = join(projectDir, "src", "sdkTypesProbe.ts");
  const nodeNextConfig = join(projectDir, "tsconfig.nodenext.json");
  writeFileSync(probeFile, SDK_TYPE_PROBE);
  writeFileSync(
    nodeNextConfig,
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      files: ["src/sdkTypesProbe.ts"],
    }),
  );
  const tscProbe = runNode(projectDir, join(projectDir, "node_modules", "typescript", "bin", "tsc"), ["-p", ".", "--noEmit", "--skipLibCheck", "false"]);
  const tscNodeNext = runNode(projectDir, join(projectDir, "node_modules", "typescript", "bin", "tsc"), ["-p", "tsconfig.nodenext.json"]);
  unlinkSync(probeFile);
  unlinkSync(nodeNextConfig);
  assert.equal(tscProbe.status, 0, tscProbe.output);
  assert.equal(tscNodeNext.status, 0, tscNodeNext.output);

  const tscRes = runNode(projectDir, join(projectDir, "node_modules", "typescript", "bin", "tsc"), ["-p", ".", "--noEmit"]);
  assert.equal(tscRes.status, 0, tscRes.output);

  const eslintRes = runNode(projectDir, join(projectDir, "node_modules", "eslint", "bin", "eslint.js"), ["."]);
  assert.equal(eslintRes.status, 0, eslintRes.output);

  const cliBin = join(projectDir, "node_modules", "fuyu-plugin", "bin", "fuyu-plugin.mjs");
  const versionRes = runNode(projectDir, cliBin, ["version"]);
  assert.equal(versionRes.status, 0, versionRes.output);
  assert.equal(versionRes.stdout.trim(), "2.0.0");

  const checkRes = runNode(projectDir, cliBin, ["check", "--market"]);
  assert.equal(checkRes.status, 0, checkRes.output);

  const packRes = runNode(projectDir, cliBin, ["pack"]);
  assert.equal(packRes.status, 0, packRes.output);
  assert.ok(existsSync(join(projectDir, "build", "someone-ext-timer-0.1.0.fuyu")));
  const builtManifest = JSON.parse(readFileSync(join(projectDir, "build", "package", "package.json"), "utf8"));
  assert.equal(builtManifest.fuyu.builtWith, "2.0.0");

  const iconRes = runNode(projectDir, cliBin, ["icon", "--glyph", "rocket", "--color", "#c76be0", "--out", "build/icon-probe.svg"]);
  assert.equal(iconRes.status, 0, iconRes.output);
  assert.match(readFileSync(join(projectDir, "build", "icon-probe.svg"), "utf8"), /stroke="#c76be0"[^>]*><path d="/);

  const previewRes = runNode(projectDir, cliBin, ["preview"]);
  assert.equal(previewRes.status, 0, previewRes.output);
  const previewHtml = readFileSync(join(projectDir, "build", "preview.html"), "utf8");
  assert.ok(previewHtml.includes(".market-card {") && previewHtml.includes('<button class="market-card__name"'), "the preview carries the market styles and the card");

  const noBrowser = { CHROME_PATH: join(scratch, "no-such-browser") };
  const shotsBare = runNode(projectDir, cliBin, ["shots"], noBrowser);
  assert.equal(shotsBare.status, 1);
  assert.match(shotsBare.output, /needs react and react-dom/);
  for (const dep of ["react", "react-dom"]) linkDir(join(REPO_ROOT, "node_modules", dep), join(projectDir, "node_modules", "fuyu-plugin", "node_modules", dep));
  const shotsOwn = runNode(projectDir, cliBin, ["shots"], noBrowser);
  assert.equal(shotsOwn.status, 1);
  assert.match(shotsOwn.output, /CHROME_PATH points to .*no-such-browser/, shotsOwn.output);

  const hostDir = join(scratch, "host-data");
  mkdirSync(hostDir, { recursive: true });
  const devRes = runNode(projectDir, cliBin, ["dev", "--once", "--data-dir", hostDir]);
  assert.equal(devRes.status, 0, devRes.output);

  writeFileSync(join(hostDir, "timers-stub.mjs"), TIMERS_PROVIDER_STUB);
  const existingYml = readFileSync(join(hostDir, "plugins.yml"), "utf8");
  writeFileSync(join(hostDir, "plugins.yml"), `- id: timers-stub\n  name: ./timers-stub.mjs\n${existingYml}`);

  const { startHost } = await import(pathToFileURL(join(projectDir, "node_modules", "fuyu-plugin", "dist", "host.mjs")).href);
  const host = await startHost({ dir: hostDir });
  try {
    await host.settle();
    const status = host.status().find((entry) => entry.id === "@someone/ext-timer");
    assert.equal(status?.state, "running", JSON.stringify(host.status(), null, 2));
    const listed = await host.ctx.clients.call("@someone/ext-timer", "list", null, "island");
    assert.deepEqual(listed.timers, []);
  } finally {
    await host.stop();
  }

  const bareDir = join(scratch, "bare-market-checkout");
  cpSync(projectDir, bareDir, {
    recursive: true,
    filter: (src) => !src.includes(`${join(projectDir, "node_modules")}`) && !src.includes(`${join(projectDir, "build")}`),
  });
  linkDir(join(CLI_PKG_MODULES, "esbuild"), join(packed.fuyuDir, "node_modules", "esbuild"));
  const bareCheck = runNode(bareDir, join(packed.fuyuDir, "bin", "fuyu-plugin.mjs"), ["check", "--market"]);
  assert.equal(bareCheck.status, 0, bareCheck.output);
});
