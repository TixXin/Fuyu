import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { run } from "../../scripts/heavy/heavy.mjs";
import { followJob, forwardedEnv, jobScript, psLiteral, remoteConfig, snapshotCommit } from "../../scripts/heavy/remote.mjs";

const saved = (json) => () => JSON.stringify(json);

test("remote mode follows the saved host unless switched off for this run", () => {
  const read = saved({ host: "winrel", root: "D:\\runner\\", worktrees: 4 });
  if (process.platform === "win32") {
    assert.equal(remoteConfig({}, read), null, "the Windows runner never sends jobs on again");
    return;
  }
  assert.deepEqual(remoteConfig({}, read), { host: "winrel", root: "D:/runner", worktrees: 4 });
  assert.equal(remoteConfig({ FUYU_HEAVY_REMOTE: "off" }, read), null);
  assert.equal(remoteConfig({}, saved({ host: "winrel", enabled: false })), null);
  assert.equal(remoteConfig({ FUYU_HEAVY_REMOTE: "winrel" }, saved({ enabled: false }))?.host, "winrel", "naming a host for one run overrides a disabled config");
  assert.equal(remoteConfig({}, () => { throw new Error("missing"); }), null, "no config file means local");
});

test("a host or root that could break out of the ssh or PowerShell command is refused", () => {
  if (process.platform === "win32") return;
  assert.equal(remoteConfig({ FUYU_HEAVY_REMOTE: "winrel;rm -rf ~" }, saved({})), null);
  assert.equal(remoteConfig({}, saved({ host: "-oProxyCommand=x" })), null);
  assert.equal(remoteConfig({}, saved({ host: "-v" })), null, "a leading dash would be read as an ssh option");
  assert.equal(remoteConfig({}, saved({ host: "winrel", root: "C:/x'; Remove-Item C:/ #" })).root, "C:/fuyu-runner");
  assert.equal(remoteConfig({}, saved({ host: "winrel", worktrees: 999 })).worktrees, 3);
});

test("only FUYU_ settings travel, and never the ones that would send the job on again", () => {
  const env = { FUYU_WRITE_RUST_TYPES: "1", FUYU_HEAVY_BROWSERS: "4", FUYU_HEAVY: "1", FUYU_HEAVY_REMOTE: "winrel", FUYU_HEAVY_DIR: "/tmp/q", PATH: "/usr/bin", CHROME_PATH: "/Applications/Chrome" };
  assert.deepEqual(forwardedEnv(env), { FUYU_WRITE_RUST_TYPES: "1", FUYU_HEAVY_BROWSERS: "4" });
});

test("job parameters are one PowerShell string literal, whatever quotes the command holds", () => {
  assert.equal(psLiteral("it's"), "'it''s'");
  assert.equal(psLiteral("it\u2019s"), "'it\u2019\u2019s'", "PowerShell also ends a string at curly quotes");
  const script = jobScript({ argv: ["--", "node", "-e", "console.log('a’b')"] }, "exit 0");
  const literal = script.split("\n")[0].replace(/^\$p = ConvertFrom-Json /, "");
  assert.match(literal, /^'.*'$/);
  assert.equal(literal.slice(1, -1).replace(/(['\u2018\u2019\u201a\u201b])\1/g, "$1"), JSON.stringify({ argv: ["--", "node", "-e", "console.log('a’b')"] }));
});

test("packing the working tree takes untracked and unstaged files but leaves the real index alone", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "heavy-remote-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  try {
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    writeFileSync(path.join(dir, ".gitignore"), "ignored.txt\n");
    writeFileSync(path.join(dir, "a.txt"), "one\n");
    git("add", ".");
    git("commit", "-qm", "base");
    const head = git("rev-parse", "HEAD");
    assert.deepEqual(snapshotCommit(dir), { sha: head, dirty: false });

    writeFileSync(path.join(dir, "a.txt"), "two\n");
    writeFileSync(path.join(dir, "new.txt"), "new\n");
    writeFileSync(path.join(dir, "ignored.txt"), "x\n");
    git("add", "a.txt");
    writeFileSync(path.join(dir, "a.txt"), "three\n");
    const staged = git("diff", "--cached", "--name-only");
    const status = git("status", "--porcelain");

    const { sha, dirty } = snapshotCommit(dir);
    assert.equal(dirty, true);
    assert.equal(git("rev-parse", `${sha}^`), head);
    assert.equal(git("show", `${sha}:a.txt`), "three", "the file as it is on disk, not as staged");
    assert.equal(git("show", `${sha}:new.txt`), "new");
    assert.throws(() => git("show", `${sha}:ignored.txt`), "ignored files stay home");
    assert.equal(git("diff", "--cached", "--name-only"), staged, "what another session staged is still staged");
    assert.equal(git("status", "--porcelain"), status);
    assert.equal(git("rev-parse", "HEAD"), head);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("heavy runs the job locally when the remote cannot take it, and only remotely when it can", () => {
  if (process.platform === "win32") return;
  const dir = mkdtempSync(path.join(tmpdir(), "heavy-remote-run-"));
  const config = path.join(dir, "remote.json");
  writeFileSync(config, JSON.stringify({ host: "winrel" }));
  const env = { FUYU_HEAVY_DIR: dir, FUYU_HEAVY_SLOTS: "1", FUYU_HEAVY: "", FUYU_HEAVY_REMOTE_CONFIG: config };
  const spawned = [];
  const spawn = (cmd, args) => {
    spawned.push([cmd, ...args].join(" "));
    return { status: 0 };
  };
  try {
    assert.equal(run(["--", "cargo", "test"], env, { spawn, afterJob: () => {}, log: () => {}, remote: () => 5 }), 5);
    assert.deepEqual(spawned, [], "nothing compiles on this machine");
    assert.equal(run(["--", "cargo", "test"], env, { spawn, afterJob: () => {}, log: () => {}, remote: () => null }), 0);
    assert.deepEqual(spawned, ["cargo test"], "an unreachable remote falls back to the local queue");
    let asked = 0;
    run(["--", "cargo", "test"], { ...env, FUYU_HEAVY: "1" }, { spawn, afterJob: () => {}, log: () => {}, remote: () => { asked += 1; return 0; } });
    assert.equal(asked, 0, "a job already inside the queue is never sent on");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fakeRemote(states, streams = []) {
  const clock = { t: 0 };
  const calls = { offsets: [], cancel: 0, waited: [], logs: [] };
  return {
    calls,
    options: {
      follow: async (offset) => {
        calls.offsets.push(offset);
        return streams.shift() ?? { code: 255, bytes: 0 };
      },
      status: async () => states.shift(),
      cancel: async () => {
        calls.cancel += 1;
      },
      wait: async (ms) => {
        calls.waited.push(ms);
        clock.t += ms;
      },
      now: () => clock.t,
      log: (line) => calls.logs.push(line),
      host: "winrel",
      where: "winrel:C:/fuyu-runner/out/x.log",
    },
  };
}

const running = { done: false, started: true, alive: true };
const finished = (code) => ({ done: true, code, started: true, alive: false });

test("a dropped connection mid-job resumes from the bytes this machine actually got and returns the job's exit code", async () => {
  const remote = fakeRemote([null, null, running, finished(3)], [{ code: 255, bytes: 120 }, { code: 255, bytes: 0 }, { code: 255, bytes: 0 }, { code: 0, bytes: 30 }]);
  assert.equal(await followJob(remote.options), 3);
  assert.deepEqual(remote.calls.offsets, [0, 120, 120, 120], "each reconnect asks for output from where this machine stopped receiving");
  assert.equal(remote.calls.logs.filter((line) => line.includes("连接断了")).length, 1, "the drop is reported once, not every retry");
  assert.ok(remote.calls.logs.some((line) => line.includes("重新连上")));
  assert.deepEqual(remote.calls.waited.slice(0, 2), [2000, 4000], "retries back off");
});

test("a finished job whose output was cut off is followed again before its exit code counts", async () => {
  const remote = fakeRemote([finished(0), finished(0)], [{ code: 255, bytes: 20 }, { code: 0, bytes: 60 }]);
  assert.equal(await followJob(remote.options), 0);
  assert.deepEqual(remote.calls.offsets, [0, 20]);
});

test("a remote unreachable for longer than the patience gives up and says where the log is", async () => {
  const remote = fakeRemote(new Array(50).fill(null));
  assert.equal(await followJob({ ...remote.options, patience: 60_000 }), 1);
  assert.ok(remote.calls.logs.at(-1).includes("winrel:C:/fuyu-runner/out/x.log"));
});

test("a job that stopped without an exit code fails instead of waiting forever", async () => {
  const remote = fakeRemote([{ done: false, started: true, alive: false }]);
  assert.equal(await followJob(remote.options), 1);
});

test("stopping on this machine cancels the remote job", async () => {
  const remote = fakeRemote([]);
  assert.equal(await followJob({ ...remote.options, stopped: () => true }), 130);
  assert.equal(remote.calls.cancel, 1);
});
