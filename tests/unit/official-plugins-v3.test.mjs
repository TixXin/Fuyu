import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { SLOT_THEME } from "../../packages/plugin-base/src/protocol.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { review } from "../../packages/plugin-review/src/index.mjs";
import { mediaV1, messagesV1, timersV1, todosV1 } from "../../packages/plugin-services/src/index.mjs";

const OFFICIAL_ROOT = fileURLToPath(new URL("../../plugins/v3/official", import.meta.url));
const OFFICIAL_PLUGINS = [
  "pomodoro",
  "todo-digest",
  "todo-ring",
  "now-playing",
  "weather",
  "github-issues",
  "system-monitor",
];

const scratch = mkdtempSync(join(tmpdir(), "fuyu-official-plugins-v3-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function collectCssFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectCssFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      found.push(full);
    }
  }
  return found;
}

test("all 7 official v3 plugins pass check, pack, review, slot theme checks, and run together in startHost", async () => {
  const packedById = new Map();

  for (const slug of OFFICIAL_PLUGINS) {
    const dir = join(OFFICIAL_ROOT, slug);
    const expectedId = `@fuyu/${slug}`;

    assert.equal(existsSync(join(dir, "dist")), false, `${expectedId} source directory must not keep dist/`);
    assert.equal(existsSync(join(dir, "build")), false, `${expectedId} source directory must not keep build/`);

    const checkResult = await check(dir, { official: true, allowExperimental: false });
    assert.equal(checkResult.ok, true, `${expectedId} check errors: ${JSON.stringify(checkResult.errors)}`);
    assert.deepEqual(checkResult.errors, [], `${expectedId} check errors must be empty`);
    assert.deepEqual(checkResult.warnings, [], `${expectedId} check warnings must be empty`);

    const outDir = join(scratch, "built", slug);
    const packDir = join(scratch, "packed", slug);
    const packed = await pack(dir, {
      official: true,
      allowExperimental: false,
      outDir,
      packDir,
    });
    assert.equal(packed.manifest.name, expectedId);
    assert.equal(existsSync(packed.file), true, `${expectedId} must produce a .fuyu package`);
    assert.ok(packed.file.endsWith(".fuyu"));
    assert.ok(statSync(packed.file).size > 0);
    if (slug === "system-monitor") {
      assert.ok(
        Array.isArray(packed.manifest.fuyu.nodeApis) && packed.manifest.fuyu.nodeApis.includes("os"),
        `@fuyu/system-monitor built manifest must declare "os" in fuyu.nodeApis, got ${JSON.stringify(packed.manifest.fuyu.nodeApis)}`,
      );
    }

    const report = review({
      oldDir: null,
      newDir: dir,
      newBuilt: packed.outDir,
    });
    const redFindings = report.findings.filter((item) => item.tier === "red");
    assert.deepEqual(redFindings, [], `${expectedId} review must have zero red findings`);
    assert.deepEqual(report.summary.network.undeclared, [], `${expectedId} must have zero undeclared network hosts`);

    const cssFiles = collectCssFiles(dir);
    assert.ok(cssFiles.length > 0, `${expectedId} should include at least one .css stylesheet`);
    for (const cssFile of cssFiles) {
      const css = readFileSync(cssFile, "utf8");
      assert.doesNotMatch(
        css,
        /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i,
        `${expectedId} (${cssFile}) must not hardcode #hex, rgb(), or hsl() colors`,
      );
      const vars = [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name);
      assert.ok(vars.length > 0, `${expectedId} (${cssFile}) should use --fuyu-plugin-* theme variables`);
      const invalidVars = vars.filter((name) => !SLOT_THEME.includes(name));
      assert.deepEqual(invalidVars, [], `${expectedId} (${cssFile}) uses non-SLOT_THEME variables: ${invalidVars.join(", ")}`);
    }

    packedById.set(expectedId, packed);
  }

  const hostDir = join(scratch, "host-data");
  mkdirSync(hostDir, { recursive: true });
  for (const [expectedId, packed] of packedById) {
    const installed = installPackage(packed.file, {
      dir: hostDir,
      source: "market",
      expectedSha256: packed.sha256,
    });
    assert.equal(installed.id, expectedId);
  }

  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  const providers = [];
  try {
    providers.push(
      host.ctx.services.provide(timersV1, {
        list: async () => ({ timers: [], at: Date.now() }),
        start: async () => ({ timer: { id: "t-1", kind: "countdown", durationMs: 60_000, remainingMs: 60_000, running: true, alerted: false } }),
        pause: async () => {},
        resume: async () => {},
        extend: async () => {},
        remove: async () => {},
        dismissRinging: async () => {},
        adopt: async () => [],
      }),
      host.ctx.services.provide(todosV1, {
        list: async () => ({ date: "2026-11-17", todos: [] }),
        days: async () => ({ days: [] }),
        add: async (params) => ({ id: "todo-1", title: params?.title ?? "", completed: false }),
        update: async () => {},
        remove: async () => {},
        note: async () => ({ date: "2026-11-17", note: "" }),
        setNote: async () => {},
      }),
      host.ctx.services.provide(mediaV1, {
        nowPlaying: async () => ({
          available: false,
          playing: false,
          audible: false,
          title: null,
          artist: null,
          album: null,
          sourceApp: null,
          positionMs: 0,
          durationMs: 0,
          canSeek: false,
          canNext: false,
          canPrevious: false,
          updatedAt: Date.now(),
        }),
        playPause: async () => {},
        next: async () => {},
        previous: async () => {},
        seek: async () => {},
      }),
      host.ctx.services.provide(messagesV1, {
        sources: async () => ({ sources: [] }),
        notify: async () => ({ id: "msg-1" }),
        clear: async () => {},
      }),
    );

    await host.settle();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const current = host.status();
      if (OFFICIAL_PLUGINS.every((slug) => current.find((entry) => entry.id === `@fuyu/${slug}`)?.state === "running")) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const statuses = host.status();
    for (const slug of OFFICIAL_PLUGINS) {
      const id = `@fuyu/${slug}`;
      const status = statuses.find((entry) => entry.id === id);
      assert.ok(status, `${id} must appear in host.status()`);
      assert.equal(status.state, "running", `${id} expected running, got ${JSON.stringify(status)}`);
      assert.equal(status.source, "market");
      assert.equal(status.undeclared, undefined, `${id} must have no undeclared capabilities: ${JSON.stringify(status.undeclared)}`);
    }

    const initialState = await host.ctx.clients.call("@fuyu/system-monitor", "getState", { locale: "zh-CN" });
    assert.equal(initialState.sampling, true);
    assert.ok(initialState.sample !== null);
    assert.ok(initialState.sample.cpuPercent >= 0 && initialState.sample.cpuPercent <= 100);
    assert.ok(Array.isArray(initialState.sample.cores) && initialState.sample.cores.length > 0);
    assert.ok(initialState.sample.cores.every((pct) => pct >= 0 && pct <= 100));
    assert.ok(initialState.sample.memoryTotalBytes > 0);
    assert.ok(initialState.sample.memoryUsedBytes >= 0 && initialState.sample.memoryUsedBytes <= initialState.sample.memoryTotalBytes);
    assert.ok(initialState.sample.memoryPercent >= 0 && initialState.sample.memoryPercent <= 100);
    assert.ok(initialState.sample.uptimeSec >= 0);
    assert.ok(initialState.sample.hostname.length > 0);
    assert.ok(initialState.sample.arch.length > 0);
    assert.equal(host.timers()["@fuyu/system-monitor"], 1);

    const idleState = await host.ctx.clients.call("@fuyu/system-monitor", "setConfig", {
      showOnBar: false,
      intervalMs: 5000,
    });
    assert.equal(idleState.sampling, false);
    assert.equal(idleState.config.showOnBar, false);
    assert.equal(idleState.config.intervalMs, 5000);
    assert.equal(host.timers()["@fuyu/system-monitor"] ?? 0, 0);

    const watchingState = await host.ctx.clients.call("@fuyu/system-monitor", "watchPage", {
      viewerId: "page-1",
      active: true,
    });
    assert.equal(watchingState.sampling, true);
    assert.equal(host.timers()["@fuyu/system-monitor"], 1);

    const closedState = await host.ctx.clients.call("@fuyu/system-monitor", "watchPage", {
      viewerId: "page-1",
      active: false,
    });
    assert.equal(closedState.sampling, false);
    assert.equal(host.timers()["@fuyu/system-monitor"] ?? 0, 0);
  } finally {
    for (const provider of providers) {
      await provider.dispose();
    }
    await host.stop();
  }
});
