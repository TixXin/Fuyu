const code = (value) => `\`${value}\``;
const text = (value) => String(value ?? "").replaceAll("\n", " ").trim();
const cell = (value) => text(value).replaceAll("|", "\\|");

function table(head, rows) {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}

const GROUPS = [
  { title: "宿主、设置与运行信息", match: (name) => /^(host|settings|ui)\./.test(name) },
  { title: "权限", match: (name) => name.startsWith("permissions.") },
  { title: "事件订阅", match: (name) => name.startsWith("events.") },
  { title: "岛上界面", match: (name) => /^(view|webview|status|island)\./.test(name) },
  { title: "插件自己的数据", match: (name) => /^(storage|secrets)\./.test(name) },
  { title: "待办与每日笔记", match: (name) => /^(todos|note)\./.test(name) },
  { title: "AI Agent 状态", match: (name) => name.startsWith("agentStatus.") },
  { title: "剪贴板、消息与文件中转", match: (name) => /^(clipboard|messages|shelf)\./.test(name) },
  { title: "媒体", match: (name) => name.startsWith("media.") },
  { title: "其他", match: () => true },
];

function paramList(value) {
  if (value === null || value === undefined) return "- 参数：无";
  if (typeof value === "string") return `- 参数：${text(value)}`;
  return ["- 参数：", ...Object.entries(value).map(([key, about]) => `  - ${code(key)}：${text(about)}`)].join("\n");
}

function method(item, sensitive) {
  const permission = item.permission ? `${code(item.permission)}${sensitive.has(item.permission) ? "（敏感）" : ""}` : "不需要";
  const lines = [`### ${code(item.name)}`, "", `- 权限：${permission}`];
  if (item.capability) lines.push(`- 能力：${code(item.capability)}`);
  lines.push(paramList(item.params), `- 结果：${text(item.result)}`);
  return lines.join("\n");
}

function notification(item) {
  const lines = [`### ${code(item.name)}`, ""];
  if (typeof item.params === "string" || item.params == null) lines.push(text(item.params) || "无参数。");
  else lines.push(paramList(item.params).replace(/^- 参数：/, "参数："));
  return lines.join("\n");
}

export function apiReference(rpc) {
  const sensitive = new Set(rpc.permissions.filter((item) => item.sensitive).map((item) => item.name));
  const permission = (name) => (name ? code(name) : "不需要");
  const groups = GROUPS.map((group) => ({ ...group, methods: [] }));
  for (const item of rpc.methods) groups.find((group) => group.match(item.name)).methods.push(item);
  const v1Methods = rpc.methods.filter((item) => item.since === 1).map((item) => code(item.name));

  return `# 插件 API 参考

> 由 \`pnpm sdk:build\` 根据 [\`plugins/schema/rpc.json\`](../../plugins/schema/rpc.json) 生成，不要手改。各项的说明直接取自这份协议文件，是英文；用法和例子见 [岛上界面](ui.md)、[运行与通信](runtime.md) 和 [权限与安全](permissions.md)。

插件和岛屿通过 stdin / stdout 交换 JSON-RPC 2.0 消息，每行一条。本页按插件 API 第 ${rpc.apiVersions.current} 版写（清单 \`"apiVersion": ${rpc.apiVersions.current}\`）。还在用第 1 版的插件能调用的方法只有：${v1Methods.join("、")}，见 [运行与通信](runtime.md#第-1-版插件)。

## 能力

\`initialize.capabilities\` 列出岛屿为这个插件提供的能力。以后的岛屿可能增加新能力，用之前先查这个列表；旧版岛屿会忽略它不认识的可选字段。

${table(["能力", "含义"], rpc.capabilities.map((item) => [code(item.name), cell(item.meaning)]))}

## 权限一览

敏感权限在插件第一次使用时还要用户在岛上确认，拒绝时返回 \`-32001\`。详见 [权限与安全](permissions.md)。

${table(["权限", "敏感"], rpc.permissions.map((item) => [code(item.name), sensitive.has(item.name) ? "是" : ""]))}

${groups
  .filter((group) => group.methods.length)
  .map((group) => `## ${group.title}\n\n${group.methods.map((item) => method(item, sensitive)).join("\n\n")}`)
  .join("\n\n")}

## 事件

用 \`events.subscribe\` 订阅，岛屿用通知 \`event { name, payload }\` 推送。

${table(["事件", "权限", "载荷"], rpc.events.map((item) => [code(item.name), permission(item.permission), cell(item.payload)]))}

## 岛屿发给插件的通知

${rpc.toPlugin.map(notification).join("\n\n")}

## 插件发给岛屿的通知

${rpc.fromPlugin.map(notification).join("\n\n")}

## 错误码

${table(["代码", "含义"], rpc.errors.map((item) => [code(item.code), cell(item.meaning)]))}
`;
}
