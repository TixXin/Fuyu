const TIER_TITLES = {
  green: "🟢 绿档：没有敏感变化，扫一眼差异就能批",
  yellow: "🟡 黄档：下面每一项都要看，必要时请作者说明",
  red: "🔴 红档：自动拒绝",
};
const TIER_ICONS = { red: "🔴", yellow: "🟡", info: "⚪" };
const CHECK_TITLES = {
  release: "上架",
  manifest: "清单",
  nodeApis: "Node 模块",
  network: "联网",
  dependencies: "依赖",
  sensitive: "敏感调用",
  obfuscation: "混淆迹象",
  files: "文件",
  size: "改动量",
};
const MAX_FINDINGS = 80;

export function code(value) {
  const text = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, "")
    .slice(0, 120);
  if (!text) return "";
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") || text.startsWith(" ") || text.endsWith(" ") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function list(values, empty = "无") {
  return values.length ? values.map((value) => code(String(value).replace(/\|/g, "¦"))).join("、") : empty;
}

function location(finding) {
  if (!finding.file) return "";
  return code(finding.line ? `${finding.file}:${finding.line}` : finding.file);
}

function findingLine(finding) {
  const parts = [`${TIER_ICONS[finding.tier]} **${finding.message}**`];
  if (finding.detail) parts.push(code(finding.detail));
  const at = location(finding);
  if (at) parts.push(`— ${at}`);
  if (finding.lines && finding.lines.length > 1) parts.push(`（第 ${finding.lines.join("、")} 行）`);
  let line = `- ${parts.join(" ")}`;
  if (finding.snippet) line += `\n  ${code(finding.snippet)}`;
  return line;
}

export function renderMarkdown(report) {
  const { summary, plugin } = report;
  const out = [];
  const range = report.firstRelease ? `${code(plugin.to)}（首次上架）` : `${code(plugin.from)} → ${code(plugin.to)}`;
  out.push(`## 插件审核：${TIER_TITLES[report.tier]}`, "", `${code(plugin.name ?? "（没有名字）")} ${range}`, "");

  const deps = summary.dependencies;
  const depCount = deps.added.length + deps.changed.length + deps.removed.length + deps.tampered.length + deps.declared.length;
  out.push("| 项 | 结果 |", "|---|---|");
  out.push(`| Node 内置模块 | 新增 ${list(summary.nodeApis.added)}；全部 ${list(summary.nodeApis.all)} |`);
  out.push(`| 联网域名 | 新增 ${list(summary.network.added)}；没声明 ${list(summary.network.undeclared)}；清单声明 ${list(summary.network.declared)} |`);
  out.push(`| 依赖 | ${depCount ? `新增 ${deps.added.length}、换版本 ${deps.changed.length}、删除 ${deps.removed.length}、同版本内容变了 ${deps.tampered.length}、package.json 改动 ${deps.declared.length}` : "没有变化"}（${deps.lockfile ? code(deps.lockfile) : "没有锁文件"}） |`);
  out.push(`| 提供 / 替换的服务 | ${list(summary.manifest.provides)} / ${list(summary.manifest.replaces)} |`);
  out.push(`| 实验接口 | ${list(summary.manifest.experimental)} |`);
  out.push(`| 改动 | 新增 ${summary.files.added.length}、修改 ${summary.files.changed.length}、删除 ${summary.files.removed.length} 个文件，+${summary.lines.added} / -${summary.lines.removed} 行（超过 ${summary.lines.threshold} 行算黄档） |`);
  out.push(`| 构建产物 | ${summary.built ? "已一起检查" : "没有提供"} |`, "");

  const visible = report.findings.filter((f) => f.tier !== "info");
  if (!visible.length) {
    out.push("没有命中任何检查项。");
  } else {
    out.push(report.tier === "red" ? "### 拒绝的原因和其他问题" : "### 要逐项看的");
    const groups = new Map();
    for (const finding of visible.slice(0, MAX_FINDINGS)) {
      if (!groups.has(finding.check)) groups.set(finding.check, []);
      groups.get(finding.check).push(finding);
    }
    for (const [check, findings] of groups) {
      out.push("", `**${CHECK_TITLES[check] ?? check}**`, "", ...findings.map(findingLine));
    }
    if (visible.length > MAX_FINDINGS) out.push("", `还有 ${visible.length - MAX_FINDINGS} 条没列出，完整结果在 JSON 报告里。`);
  }
  out.push("", "<sub>由 `@fuyu/plugin-review` 生成。分档只是给维护者的提示：每个版本都要维护者看过差异后点批准。</sub>", "");
  return out.join("\n");
}
