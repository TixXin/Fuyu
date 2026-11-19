import type { Exec } from "../exec.ts";
import { rankPrograms } from "../programs.ts";
import { NetworkMeter } from "../rates.ts";
import { ABSENT, PENDING, UNSUPPORTED, failed, ok, type Source } from "../source.ts";
import { parseIoreg, parseNetstat, parsePmset, parsePs, parseVmStat } from "./parse.ts";

export const MAC_COMMANDS = {
  vmStat: ["/usr/bin/vm_stat", []],
  netstat: ["/usr/sbin/netstat", ["-ibn"]],
  ps: ["/bin/ps", ["-Axo", "pid=,pcpu=,rss=,comm="]],
  pmset: ["/usr/bin/pmset", ["-g", "batt"]],
  ioreg: ["/usr/sbin/ioreg", ["-r", "-d", "1", "-w", "0", "-c", "IOAccelerator"]],
  activityMonitor: ["/usr/bin/open", ["-b", "com.apple.ActivityMonitor"]],
} as const satisfies Record<string, readonly [string, readonly string[]]>;

type CommandName = keyof typeof MAC_COMMANDS;

export function createMacSource(exec: Exec, cores: () => number): Source {
  const network = new NetworkMeter();
  const run = (name: CommandName) => {
    const [file, args] = MAC_COMMANDS[name];
    return exec.run(file, args);
  };

  return {
    platform: "macos",
    cheapBackground: true,
    async memoryUsedBytes() {
      try {
        return parseVmStat(await run("vmStat"))?.usedBytes ?? null;
      } catch {
        return null;
      }
    },
    async cpuTemperature() {
      return UNSUPPORTED;
    },
    async gpu() {
      try {
        const gpu = parseIoreg(await run("ioreg"));
        if (!gpu) return ABSENT;
        return ok({
          name: gpu.name,
          percent: gpu.percent,
          temperatureC: null,
          memoryUsedBytes: gpu.memoryUsedBytes,
          memoryTotalBytes: null,
          powerW: null,
          engines: [],
        });
      } catch (error) {
        return failed(error);
      }
    },
    async network(at) {
      try {
        const counters = parseNetstat(await run("netstat"));
        if (!counters) return failed(new Error("netstat: unexpected output"));
        const rate = network.next({ at, ...counters });
        return rate ? ok(rate) : PENDING;
      } catch (error) {
        return failed(error);
      }
    },
    async battery() {
      try {
        const { battery } = parsePmset(await run("pmset"));
        return battery ? ok(battery) : ABSENT;
      } catch (error) {
        return failed(error);
      }
    },
    async programs() {
      try {
        const rows = parsePs(await run("ps"), cores());
        return ok(rankPrograms(rows));
      } catch (error) {
        return failed(error);
      }
    },
    async programIcons() {
      return {};
    },
    async openTaskManager() {
      const [file, args] = MAC_COMMANDS.activityMonitor;
      await exec.launch(file, args);
    },
    resetNetwork() {
      network.reset();
    },
    resetPrograms() {},
    dispose() {},
  };
}
