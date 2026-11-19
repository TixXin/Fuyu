import type { LauncherState, RankedApp } from "../src/model.ts";
import { DEFAULT_SETTINGS } from "../src/settingsModel.ts";

const NOW = Date.parse("2026-11-19T10:24:00");
const MINUTE = 60_000;

const used: [name: string, folder: string, count: number, minutesAgo: number][] = [
  ["Visual Studio Code", "Microsoft VS Code", 86, 4],
  ["微信", "Tencent", 142, 11],
  ["Google Chrome", "Google", 203, 26],
  ["Figma", "Figma", 37, 58],
  ["网易云音乐", "Netease", 64, 95],
  ["Obsidian", "Obsidian", 51, 170],
  ["Windows Terminal", "Microsoft", 29, 260],
  ["Excel", "Microsoft Office", 18, 1500],
];

const unused: [name: string, folder: string][] = [
  ["Blender", "Blender Foundation"],
  ["OBS Studio", "obs-studio"],
  ["PowerPoint", "Microsoft Office"],
  ["Steam", "Steam"],
  ["Word", "Microsoft Office"],
  ["腾讯会议", "Tencent"],
];

const pathOf = (name: string, folder: string) => `apps/${folder}/${name}.lnk`;

const apps: RankedApp[] = [
  ...used.map(([name, folder, count, minutesAgo]) => ({
    id: pathOf(name, folder),
    name,
    path: pathOf(name, folder),
    folder,
    count,
    lastLaunchedAt: NOW - minutesAgo * MINUTE,
    recent: true,
  })),
  ...unused.map(([name, folder]) => ({
    id: pathOf(name, folder),
    name,
    path: pathOf(name, folder),
    folder,
    count: 0,
    lastLaunchedAt: 0,
    recent: false,
  })),
];

const state: LauncherState = {
  apps,
  excludedApps: [],
  totalCount: apps.length,
  recentCount: used.length,
  scannedAt: NOW - 2 * MINUTE,
  updatedAt: NOW,
  settings: DEFAULT_SETTINGS,
};

export default {
  now: NOW,
  host: {
    calls: {
      getState: state,
    },
  },
  shots: [{ slot: "island.page/v1", file: "page.png" }],
};
