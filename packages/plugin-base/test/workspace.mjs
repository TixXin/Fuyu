import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const PROBE = `globalThis.probe ??= { provided: 0, applied: 0, live: 0, cleaned: 0, pings: 0 };\n`;

export const PLUGINS = {
  "counter.mjs": `${PROBE}import { Service } from "@fuyu/plugin-base";
export default class Counter extends Service {
  constructor(ctx) {
    super(ctx, "counter");
    this.value = 0;
    globalThis.probe.provided += 1;
  }
  add() {
    this.value += 1;
    return this.value;
  }
}
`,
  "user.mjs": `${PROBE}export const name = "user";
export const inject = ["counter"];
export function apply(ctx) {
  globalThis.probe.applied += 1;
  ctx.counter.add();
  ctx.effect(() => {
    const timer = setInterval(() => {}, 1000);
    globalThis.probe.live += 1;
    return () => {
      clearInterval(timer);
      globalThis.probe.live -= 1;
      globalThis.probe.cleaned += 1;
    };
  });
  ctx.on("probe/ping", () => {
    globalThis.probe.pings += 1;
  });
}
`,
  "broken.mjs": `${PROBE}export const name = "broken";
export function apply(ctx) {
  ctx.effect(() => {
    globalThis.probe.live += 1;
    return () => {
      globalThis.probe.live -= 1;
      globalThis.probe.cleaned += 1;
    };
  });
  throw new Error("broken on purpose");
}
`,
};

export function resetProbe() {
  globalThis.probe = { provided: 0, applied: 0, live: 0, cleaned: 0, pings: 0 };
  return globalThis.probe;
}

export function workspace(files) {
  const dir = mkdtempSync(join(tmpdir(), "plugin-base-"));
  write(dir, files);
  return { dir, write: (more) => write(dir, more), remove: () => rmSync(dir, { recursive: true, force: true }) };
}

function write(dir, files) {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
}

export function config(entries) {
  return entries
    .map(({ id, name, disabled, extra = "" }) => `- id: ${id}\n  name: ${name}\n${disabled ? "  disabled: true\n" : ""}${extra}`)
    .join("");
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(10);
  }
  return check();
}
