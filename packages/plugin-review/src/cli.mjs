#!/usr/bin/env node
import { realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { renderMarkdown } from "./markdown.mjs";
import { review } from "./review.mjs";

const USAGE = `用法：fuyu-plugin-review <旧版本目录 | -> <新版本目录> [选项]

  -              没有旧版本（首次上架）
  --old-built    旧版本的构建产物目录
  --new-built    新版本的构建产物目录
  --json <文件>  把 JSON 报告写到文件
  --markdown <文件>  把 Markdown 报告写到文件
  --format <json|markdown>  标准输出的格式，默认 markdown

退出码：0 绿档或黄档，1 红档，2 参数或读取出错。`;

export function run(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        "old-built": { type: "string" },
        "new-built": { type: "string" },
        json: { type: "string" },
        markdown: { type: "string" },
        format: { type: "string", default: "markdown" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (positionals.length !== 2 || !["json", "markdown"].includes(values.format)) {
    io.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const [oldArg, newArg] = positionals;
  let report;
  try {
    report = review({
      oldDir: oldArg === "-" ? null : resolve(oldArg),
      newDir: resolve(newArg),
      oldBuilt: values["old-built"] ? resolve(values["old-built"]) : null,
      newBuilt: values["new-built"] ? resolve(values["new-built"]) : null,
    });
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);
  if (values.json) writeFileSync(values.json, json);
  if (values.markdown) writeFileSync(values.markdown, markdown);
  io.stdout.write(values.format === "json" ? json : markdown);
  return report.tier === "red" ? 1 : 0;
}

function isMain() {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = run(process.argv.slice(2));
}
