import type { MarketPlugin, MarketSnapshot } from "../../../../src/features/plugins/api";

type Entry = Pick<MarketPlugin, "id" | "name" | "description" | "version" | "author" | "publisher" | "categories" | "runtime"> & { verified?: boolean };

const ENTRIES: Entry[] = [
  {
    id: "io.github.shenglin1001.squeue", version: "0.2.0", author: "ShengLin1001", publisher: "ShengLin1001", categories: ["developer"], runtime: "node", verified: true,
    name: { "zh-CN": "HPC 排队作业", en: "HPC jobs" },
    description: { "zh-CN": "在岛上看集群里运行和排队的作业，饼图一眼看清", en: "Running and queued cluster jobs on the island, as a pie" },
  },
  {
    id: "dev.focusd.system-monitor", version: "1.3.1", author: "TixXin", publisher: null, categories: ["information"], runtime: "powershell",
    name: { "zh-CN": "系统监控", en: "System monitor" },
    description: { "zh-CN": "CPU、内存、网速放在收起的岛上", en: "CPU, memory and network speed on the collapsed island" },
  },
  {
    id: "io.github.shenglin1001.battery", version: "1.1.0", author: "ShengLin1001", publisher: "ShengLin1001", categories: ["information"], runtime: "powershell", verified: true,
    name: { "zh-CN": "电量", en: "Battery" },
    description: { "zh-CN": "笔记本和蓝牙设备的电量", en: "Laptop and Bluetooth battery levels" },
  },
  {
    id: "io.github.shenglin1001.timesync", version: "1.0.2", author: "ShengLin1001", publisher: "ShengLin1001", categories: ["utilities"], runtime: "powershell", verified: true,
    name: { "zh-CN": "对时", en: "Time sync" },
    description: { "zh-CN": "看系统时钟差了几秒，一键对时", en: "See how far the clock drifted, sync in one click" },
  },
];

export const MARKET: MarketSnapshot = {
  indexUrl: "https://fuyu.ing/plugins/index.json",
  nodeAvailable: true,
  powershellAvailable: true,
  trustedPublishers: ["ShengLin1001"],
  officialPublisher: "TixXin",
  plugins: ENTRIES.map(({ verified, ...entry }) => ({
    ...entry,
    apiVersion: 1, minAppVersion: null, homepage: "", permissions: [], download: { url: "", sha256: "", size: 0 },
    repo: null, installedVersion: null, incompatible: null, revoked: null, signedBy: entry.publisher, signingKeyChanged: false,
    ...(verified ? { verified: { via: "github" as const } } : {}),
  })),
};
