import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { MACHINE_ALIAS_KEY, MACHINE_KEY, machineName, machineSlug, thisMachine } from "../../scripts/machine-name.mjs";

function fakeConfig(initial = {}) {
  const store = new Map(Object.entries(initial).map(([key, values]) => [key, [...values]]));
  const config = ([first, second, third]) => {
    if (first === "--get") return store.get(second)?.at(-1) ?? "";
    if (first === "--get-all") return (store.get(second) ?? []).join("\n");
    if (first === "--add") store.set(second, [...(store.get(second) ?? []), third]);
    else store.set(first, [second]);
    return "";
  };
  return { config, store };
}

function withoutGitEnv(work) {
  const saved = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of saved) delete process.env[name];
  try {
    return work();
  } finally {
    for (const [name, value] of saved) process.env[name] = value;
  }
}

test("a machine name is the first label of the host name, lower case, at most 24 characters", () => {
  assert.equal(machineSlug("TixxindeMacBook-Air.local"), "tixxindemacbook-air");
  assert.equal(machineSlug("DESKTOP-AB12"), "desktop-ab12");
  assert.equal(machineSlug("Tixxin的MacBook Air"), "tixxin-macbook-air");
  assert.equal(machineSlug("a".repeat(40)), "a".repeat(24));
  assert.equal(machineSlug(""), "host");
  assert.equal(machineSlug("的"), "host");
});

test("on a Mac the first name comes from LocalHostName, not from the host name the network hands out", () => {
  const { config, store } = fakeConfig();
  const mac = { platform: "darwin", config, localHostName: () => "TixxindeMacBook-Air", hostname: () => "TixxindeAir.lan" };
  assert.deepEqual(thisMachine(mac), { host: "tixxindemacbook-air", aliases: [] });
  assert.deepEqual(store.get(MACHINE_KEY), ["tixxindemacbook-air"], "the first name is written down");
});

test("a Mac without a LocalHostName and every other system use the host name", () => {
  assert.equal(machineName({ platform: "darwin", config: fakeConfig().config, localHostName: () => "", hostname: () => "Mini.local" }), "mini");
  const windows = { platform: "win32", config: fakeConfig().config, localHostName: () => "never-asked", hostname: () => "Tixxin-Computer" };
  assert.equal(machineName(windows), "tixxin-computer");
});

test("once written down, the name stays whatever the system says later", () => {
  const { config, store } = fakeConfig();
  const first = { platform: "darwin", config, localHostName: () => "TixxindeMacBook-Air", hostname: () => "TixxindeMacBook-Air.local" };
  assert.equal(machineName(first), "tixxindemacbook-air");
  const later = { platform: "darwin", config, localHostName: () => "TixxindeMacBook-Air-2", hostname: () => "TixxindeAir.lan" };
  assert.equal(machineName(later), "tixxindemacbook-air");
  assert.deepEqual(store.get(MACHINE_KEY), ["tixxindemacbook-air"]);
});

test("aliases are the other names this machine has used, without the current one and without repeats", () => {
  const { config } = fakeConfig({ [MACHINE_KEY]: ["tixxindemacbook-air"], [MACHINE_ALIAS_KEY]: ["TixxindeAir.lan", "tixxindeair", "tixxindemacbook-air", " "] });
  assert.deepEqual(thisMachine({ platform: "darwin", config, localHostName: () => "x", hostname: () => "y" }), {
    host: "tixxindemacbook-air",
    aliases: ["tixxindeair"],
  });
});

test("the name and the aliases live in the repository's local git config", () => withoutGitEnv(() => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "fuyu-machine-")));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    assert.equal(machineName({ cwd: root, platform: "linux", hostname: () => "Outside.lan" }), "outside", "outside a repository there is nowhere to write, the name is still returned");
    git("init", "-q");
    assert.equal(machineName({ cwd: root, platform: "linux", hostname: () => "Net-A.lan" }), "net-a");
    assert.equal(git("config", "--local", "--get", MACHINE_KEY), "net-a");
    assert.equal(machineName({ cwd: root, platform: "linux", hostname: () => "Net-B.lan" }), "net-a", "a new network does not rename the machine");
    git("config", "--local", "--add", MACHINE_ALIAS_KEY, "Net-B.lan");
    git("config", "--local", "--add", MACHINE_ALIAS_KEY, "old-name");
    assert.deepEqual(thisMachine({ cwd: root, platform: "linux", hostname: () => "Net-B.lan" }), { host: "net-a", aliases: ["net-b", "old-name"] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}));
