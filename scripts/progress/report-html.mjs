#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReport } from "./html/page.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const HELP = [
  "用法：node scripts/progress/report-html.mjs <data.json> [--out <文件>]",
  "      node scripts/progress/report-html.mjs --progress <文件> --sessions <文件> [--prs <文件>] [--issues <文件>] [--out <文件>]",
  "",
  "把进度数据渲染成一个自带样式的 HTML（群岛 / 塔台 / 雷达三种样式可切换），不联网。",
  "  <data.json>   合在一起的数据：{ progress, sessions, mergedPrs, closedIssues, tz? }；写 - 从标准输入读",
  "  --progress    pnpm progress --json 的输出",
  "  --sessions    会话列表（字段见 .claude/skills/fuyu-progress-report/SKILL.md）",
  "  --prs         gh pr list --state merged --json number,title,mergedAt 的输出",
  "  --issues      gh issue list --state closed --json number,title,closedAt 的输出",
  "  --out         输出文件；默认 ai-guide/progress/<日期-时间>.html",
  "输出文件的路径打印到标准输出。",
].join("\n");

const PARTS = { "--progress": "progress", "--sessions": "sessions", "--prs": "mergedPrs", "--issues": "closedIssues" };

export function parseArgs(argv) {
  const options = { data: null, parts: {}, out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} 后面缺文件`);
      return value;
    };
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--out") options.out = next();
    else if (PARTS[arg]) options.parts[PARTS[arg]] = next();
    else if (arg.startsWith("--")) throw new Error(`不认识参数 ${arg}`);
    else if (options.data) throw new Error(`多给了一个数据文件 ${arg}`);
    else options.data = arg;
  }
  if (!options.help && !options.data && !options.parts.progress) throw new Error("缺数据：给一个 data.json，或者 --progress 和 --sessions");
  return options;
}

function readJson(file) {
  const text = file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8");
  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch (error) {
    throw new Error(`${file} 不是合法的 JSON：${error.message}`);
  }
}

export function loadData(options) {
  const data = options.data ? readJson(options.data) : {};
  for (const [key, file] of Object.entries(options.parts)) data[key] = readJson(file);
  if (!data.progress) throw new Error("数据里没有 progress（pnpm progress --json 的输出）");
  return data;
}

export function defaultOut(now = new Date(), root = ROOT) {
  const p = (n) => String(n).padStart(2, "0");
  const name = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.html`;
  return path.join(root, "ai-guide", "progress", name);
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(HELP);
    return null;
  }
  const html = renderReport(loadData(options));
  const out = path.resolve(options.out ?? defaultOut());
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(out);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
