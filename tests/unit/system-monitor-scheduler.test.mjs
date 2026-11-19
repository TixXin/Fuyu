import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG } from "../../plugins/v3/official/system-monitor/src/protocol.ts";
import { Scheduler } from "../../plugins/v3/official/system-monitor/src/host/scheduler.ts";
import { createMacSource, MAC_COMMANDS } from "../../plugins/v3/official/system-monitor/src/host/mac/source.ts";
import { PowerShellHelper, HELPER_FILE } from "../../plugins/v3/official/system-monitor/src/host/win/helper.ts";
import { createWindowsSource } from "../../plugins/v3/official/system-monitor/src/host/win/source.ts";

const FIXTURES = fileURLToPath(new URL("../../plugins/v3/official/system-monitor/test/fixtures/", import.meta.url));
const fixture = (name) => readFileSync(FIXTURES + name, "utf8").replace(/\r\n/g, "\n");

class Clock {
  now = 1_000_000;
  timers = [];
  nextId = 1;

  after = (callback, ms) => {
    const timer = { id: this.nextId++, at: this.now + ms, callback };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((item) => item !== timer);
    };
  };

  advance(ms) {
    const until = this.now + ms;
    for (;;) {
      const due = this.timers.filter((timer) => timer.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((timer) => timer !== due);
      this.now = due.at;
      due.callback();
    }
    this.now = until;
  }
}

class FakeChild {
  killed = false;
  listeners = { error: [], exit: [] };
  stdoutListeners = [];
  lines = [];

  constructor(answer) {
    this.answer = answer;
    this.stdin = {
      write: (chunk) => {
        for (const line of chunk.split("\n").filter(Boolean)) {
          this.lines.push(line);
          const [id, kind, argument] = line.split(" ");
          const reply = this.answer(kind, argument);
          if (reply === undefined) continue;
          queueMicrotask(() => this.emitStdout(`${JSON.stringify({ id: Number(id), ok: true, data: reply })}\r\n`));
        }
        return true;
      },
      end: () => {},
      on: () => this.stdin,
    };
    this.stdout = {
      setEncoding: () => {},
      on: (_event, listener) => {
        this.stdoutListeners.push(listener);
        return this.stdout;
      },
    };
    this.stderr = null;
  }

  emitStdout(text) {
    for (const listener of this.stdoutListeners) listener(text);
  }

  on(event, listener) {
    this.listeners[event].push(listener);
    return this;
  }

  kill() {
    if (this.killed) return true;
    this.killed = true;
    queueMicrotask(() => this.listeners.exit.forEach((listener) => listener(null, "SIGTERM")));
    return true;
  }

  crash() {
    this.killed = true;
    this.listeners.exit.forEach((listener) => listener(1, null));
  }

  unref() {}
}

const WINDOWS_ANSWERS = {
  net: () => ({ received: 1000, sent: 100 }),
  battery: () => ({ present: false }),
  thermal: () => ({ values: [3132] }),
  procs: () => ({ rows: [[10, "a.exe", 100, 1000]] }),
  gpu: () => ({ pending: true }),
  taskmgr: () => ({ started: true }),
};

function fakeExec(outputs = {}) {
  const exec = {
    runs: [],
    children: [],
    launches: [],
    answer: (kind) => WINDOWS_ANSWERS[kind]?.(),
    async run(file, args) {
      exec.runs.push([file, ...args].join(" "));
      if (file in outputs) return outputs[file];
      throw Object.assign(new Error(`${file}: ENOENT`), { missing: true });
    },
    start(file, args) {
      const child = new FakeChild((kind, argument) => exec.answer(kind, argument));
      child.file = file;
      child.args = args;
      exec.children.push(child);
      return child;
    },
    async launch(file, args) {
      exec.launches.push([file, ...args].join(" "));
    },
  };
  return exec;
}

function setup(kind, config = {}, outputs = {}) {
  const clock = new Clock();
  const exec = fakeExec(outputs);
  const cores = () => 4;
  const helper = new PowerShellHelper({ exec, now: () => clock.now, after: clock.after });
  const source =
    kind === "windows"
      ? createWindowsSource({ exec, helper, now: () => clock.now, cores })
      : createMacSource(exec, cores);
  const intervals = [];
  const published = [];
  const scheduler = new Scheduler({
    source,
    config: { ...DEFAULT_CONFIG, ...config },
    now: () => clock.now,
    every: (callback, ms) => {
      const entry = { ms, live: true };
      intervals.push(entry);
      return () => {
        entry.live = false;
      };
    },
    readCpu: () => ({ percent: 12.5, cores: [10, 15], model: "Test CPU" }),
    readMemory: () => ({ totalBytes: 32 * 1024 ** 3, freeBytes: 8 * 1024 ** 3 }),
    info: () => ({ uptimeSec: 60, hostname: "test", arch: "x64" }),
    publish: (sample) => published.push(sample),
  });
  scheduler.sync();
  const live = () => intervals.filter((entry) => entry.live).map((entry) => entry.ms);
  const step = async (ms) => {
    clock.advance(ms);
    return scheduler.tick();
  };
  return { clock, exec, helper, source, scheduler, live, published, step };
}

const MAC_OUTPUTS = {
  [MAC_COMMANDS.vmStat[0]]: fixture("mac/vm_stat.txt"),
  [MAC_COMMANDS.netstat[0]]: fixture("mac/netstat-ibn.txt"),
  [MAC_COMMANDS.ps[0]]: fixture("mac/ps.txt"),
  [MAC_COMMANDS.pmset[0]]: fixture("mac/pmset-ac.txt"),
  [MAC_COMMANDS.ioreg[0]]: fixture("mac/ioreg-accelerator.txt"),
};

test("nothing samples and nothing starts while the page is closed and the bar shows nothing", async () => {
  for (const kind of ["windows", "macos"]) {
    const { exec, scheduler, live } = setup(kind, { showOnBar: false }, kind === "macos" ? MAC_OUTPUTS : {});
    assert.deepEqual(live(), []);
    assert.equal(scheduler.sampling, false);
    await scheduler.tick();
    assert.equal(exec.children.length, 0);
    assert.deepEqual(exec.runs, []);
  }
});

test("Windows: a bar with only CPU and memory never starts PowerShell or nvidia-smi", async () => {
  const { exec, live, step, scheduler } = setup("windows");
  assert.deepEqual(live(), [DEFAULT_CONFIG.intervalMs]);
  for (let i = 0; i < 10; i += 1) await step(DEFAULT_CONFIG.intervalMs);
  assert.equal(exec.children.length, 0);
  assert.deepEqual(exec.runs, []);
  assert.equal(scheduler.sample.cpuPercent, 12.5);
  assert.equal(scheduler.sample.memoryPercent, 75);
  assert.equal(scheduler.sample.network.status, "pending");
  assert.equal(scheduler.history.size, 0);
});

test("Windows: the bar's CPU temperature starts the helper, the GPU temperature only nvidia-smi", async () => {
  const cpu = setup("windows", { barCpuTemperature: true });
  await cpu.step(2000);
  assert.equal(cpu.exec.children.length, 1);
  assert.equal(cpu.exec.children[0].file, HELPER_FILE);
  assert.deepEqual(cpu.exec.children[0].lines.map((line) => line.split(" ")[1]), ["thermal"]);
  assert.deepEqual(cpu.scheduler.sample.cpuTemperatureC, { status: "ok", value: 40.1 });

  const gpu = setup("windows", { barGpuTemperature: true }, { "nvidia-smi": fixture("windows/nvidia-smi.txt") });
  await gpu.step(2000);
  assert.equal(gpu.exec.children.length, 0);
  assert.equal(gpu.exec.runs.length, 1);
  assert.equal(gpu.scheduler.sample.gpu.value.temperatureC, 54);
});

test("Windows: the page starts one helper, which quits 60 s after the page closes", async () => {
  const { exec, scheduler, helper, live, clock } = setup("windows", { showOnBar: false });
  scheduler.watch("page", true);
  assert.deepEqual(live(), [1000]);
  await scheduler.tick(true);
  clock.advance(1000);
  await scheduler.tick();
  assert.equal(exec.children.length, 1);
  assert.equal(helper.running, true);
  assert.deepEqual(scheduler.sample.network, { status: "ok", value: { downBytesPerSec: 0, upBytesPerSec: 0 } });
  assert.equal(scheduler.sample.battery.status, "absent");
  assert.equal(scheduler.sample.programs.status, "pending");
  assert.ok(scheduler.history.size >= 1);

  scheduler.watch("page", false);
  assert.deepEqual(live(), []);
  assert.equal(scheduler.history.size, 0);
  clock.advance(59_000);
  assert.equal(helper.running, true);
  clock.advance(1_500);
  assert.equal(helper.running, false);
  assert.equal(exec.children[0].killed, true);
});

test("Windows: a crashed helper is started again on the next request, and stopped when the plugin stops", async () => {
  const { exec, scheduler, helper, clock, source } = setup("windows", { showOnBar: false });
  scheduler.watch("page", true);
  await scheduler.tick(true);
  exec.children[0].crash();
  assert.equal(helper.running, false);
  clock.advance(1000);
  await scheduler.tick();
  assert.equal(exec.children.length, 2);
  await source.openTaskManager();
  assert.ok(exec.children[1].lines.some((line) => line.endsWith(" taskmgr")));
  source.dispose();
  assert.equal(exec.children[1].killed, true);
  await assert.rejects(helper.request("net"));
});

test("Windows: a helper that stops answering is killed and retried, then rested after repeated failures", async () => {
  const { exec, helper, clock } = setup("windows", { showOnBar: false });
  exec.answer = () => undefined;
  for (let i = 0; i < 3; i += 1) {
    const pending = helper.request("net");
    clock.advance(15_000);
    await assert.rejects(pending, /did not answer/);
  }
  assert.equal(exec.children.length, 3);
  await assert.rejects(helper.request("net"), /waiting before retrying/);
  assert.equal(exec.children.length, 3);
  clock.advance(60_000);
  exec.answer = (kind) => WINDOWS_ANSWERS[kind]?.();
  assert.deepEqual(await helper.request("net"), { received: 1000, sent: 100 });
});

test("background recording keeps one point every 5 s while the page is closed, and hands it to the page", async () => {
  const { scheduler, live, step, exec } = setup("macos", { showOnBar: false, backgroundHistory: true }, MAC_OUTPUTS);
  assert.deepEqual(live(), [5000]);
  for (let i = 0; i < 6; i += 1) await step(5000);
  const { points } = scheduler.historySnapshot();
  assert.equal(points.length, 6);
  assert.deepEqual(points.slice(1).map((point, index) => point.at - points[index].at), [5000, 5000, 5000, 5000, 5000]);
  assert.equal(points[0].down, null);
  assert.equal(points[1].down, 0);
  assert.equal(points[1].gpu, 51);
  assert.ok(!exec.runs.some((run) => run.startsWith("/bin/ps")), "background recording does not list programs");

  scheduler.watch("page", true);
  assert.deepEqual(live(), [1000]);
  await step(1000);
  assert.equal(scheduler.historySnapshot().points.length, 7);
  scheduler.watch("page", false);
  assert.equal(scheduler.historySnapshot().points.length, 7, "closing the page keeps the background recording");
  scheduler.setConfig({ ...DEFAULT_CONFIG, showOnBar: false, backgroundHistory: false });
  assert.equal(scheduler.historySnapshot().points.length, 0);
  assert.deepEqual(live(), []);
});

test("macOS: the page reads memory, network, battery, programs and GPU; CPU temperature is unsupported", async () => {
  const { scheduler, step, exec, source } = setup("macos", { showOnBar: false }, MAC_OUTPUTS);
  scheduler.watch("page", true);
  await scheduler.tick(true);
  const sample = await step(1000);
  assert.equal(sample.platform, "macos");
  assert.equal(sample.memoryUsedBytes, (538251 - 6100 + 229422 + 530703) * 16384);
  assert.equal(sample.network.status, "ok");
  assert.deepEqual(sample.battery, { status: "ok", value: { percent: 80, charging: false, pluggedIn: true } });
  assert.equal(sample.programs.value.byCpu[0].name, "WindowServer");
  assert.equal(sample.gpu.value.percent, 51);
  assert.deepEqual(sample.cpuTemperatureC, { status: "unsupported" });
  assert.equal(scheduler.features.cpuTemperature, false);
  assert.equal(exec.children.length, 0);
  assert.equal(exec.runs.filter((run) => run.startsWith("/bin/ps")).length, 1, "programs are read every 3 s, not every second");
  await source.openTaskManager();
  assert.deepEqual(exec.launches, ["/usr/bin/open -b com.apple.ActivityMonitor"]);
});
