import type { GpuReading, Reading } from "../../protocol.ts";
import { isMissing, type Exec } from "../exec.ts";
import { rankPrograms } from "../programs.ts";
import { NetworkMeter } from "../rates.ts";
import { ABSENT, PENDING, failed, ok, type Source } from "../source.ts";
import type { PowerShellHelper } from "./helper.ts";
import { encodeUtf8Base64 } from "./helperScript.ts";
import {
  parseBattery,
  parseGpuEngines,
  parseNetCounters,
  parseNvidiaSmi,
  parseProcesses,
  parseThermal,
  type ProcessTimes,
  type SmiGpu,
} from "./parse.ts";

export const NVIDIA_SMI: readonly [string, readonly string[]] = [
  "nvidia-smi",
  [
    "--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw",
    "--format=csv,noheader,nounits",
  ],
];

export const SMI_RETRY_MS = 5 * 60_000;

export interface WindowsSourceDeps {
  exec: Exec;
  helper: PowerShellHelper;
  now(): number;
  cores(): number;
}

export function createWindowsSource({ exec, helper, now, cores }: WindowsSourceDeps): Source {
  const network = new NetworkMeter();
  let processes: ProcessTimes | null = null;
  let smiMissingUntil = 0;

  async function readSmi(): Promise<SmiGpu | null> {
    if (now() < smiMissingUntil) return null;
    try {
      return parseNvidiaSmi(await exec.run(NVIDIA_SMI[0], NVIDIA_SMI[1], { timeoutMs: 4000 }));
    } catch (error) {
      if (isMissing(error)) smiMissingUntil = now() + SMI_RETRY_MS;
      return null;
    }
  }

  async function gpu(detail: boolean): Promise<Reading<GpuReading>> {
    const smiTask = readSmi();
    let engines: ReturnType<typeof parseGpuEngines> = null;
    let engineError: unknown = null;
    if (detail) {
      try {
        engines = parseGpuEngines(await helper.request("gpu"));
      } catch (error) {
        engineError = error;
      }
    }
    const smi = await smiTask;
    const counters = engines && engines !== "pending" ? engines : null;
    if (!smi && !counters) {
      if (engines === "pending") return PENDING;
      if (engineError) return failed(engineError);
      return ABSENT;
    }
    return ok({
      name: smi?.name ?? counters?.name ?? null,
      percent: counters?.percent ?? smi?.percent ?? null,
      temperatureC: smi?.temperatureC ?? null,
      memoryUsedBytes: smi?.memoryUsedBytes ?? counters?.memoryUsedBytes ?? null,
      memoryTotalBytes: smi?.memoryTotalBytes ?? null,
      powerW: smi?.powerW ?? null,
      engines: counters?.engines ?? [],
    });
  }

  return {
    platform: "windows",
    cheapBackground: false,
    async memoryUsedBytes() {
      return null;
    },
    async cpuTemperature() {
      try {
        const value = parseThermal(await helper.request("thermal"));
        return value === null ? ABSENT : ok(value);
      } catch (error) {
        return failed(error);
      }
    },
    gpu: ({ detail }) => gpu(detail),
    async network(at) {
      try {
        const counters = parseNetCounters(await helper.request("net"));
        if (!counters) return failed(new Error("unexpected network reply"));
        const rate = network.next({ at, ...counters });
        return rate ? ok(rate) : PENDING;
      } catch (error) {
        network.reset();
        return failed(error);
      }
    },
    async battery() {
      try {
        const battery = parseBattery(await helper.request("battery"));
        return battery ? ok(battery) : ABSENT;
      } catch (error) {
        return failed(error);
      }
    },
    async programs(at) {
      try {
        const result = parseProcesses(await helper.request("procs"), processes, at, cores());
        processes = result.times;
        return result.rows ? ok(rankPrograms(result.rows)) : PENDING;
      } catch (error) {
        processes = null;
        return failed(error);
      }
    },
    async programIcons(names) {
      const wanted = names.filter((name) => typeof name === "string" && name.length > 0).slice(0, 40);
      if (wanted.length === 0) return {};
      const data = await helper.request("icons", encodeUtf8Base64(JSON.stringify(wanted)));
      const icons = data && typeof data === "object" ? (data as { icons?: unknown }).icons : null;
      const result: Record<string, string | null> = {};
      if (icons && typeof icons === "object") {
        for (const name of wanted) {
          const value = (icons as Record<string, unknown>)[name];
          result[name] = typeof value === "string" && value.startsWith("data:image/png;base64,") ? value : null;
        }
      }
      return result;
    },
    async openTaskManager() {
      await helper.request("taskmgr");
    },
    resetNetwork() {
      network.reset();
    },
    resetPrograms() {
      processes = null;
    },
    dispose() {
      helper.dispose();
    },
  };
}
