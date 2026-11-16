import type { AgentUsageErrorKind } from "../../features/agent-status/api";
import type { AgeText } from "../../components/list/formatAgo";
import { en as commonEn, zhCN as commonZhCN } from "./common.ts";

export type ResetParts = { days: number; hours: number; minutes: number };

export type ClaudeUsageText = {
  fiveHour: string;
  sevenDay: string;
  window: (label: string, percent: number, reset: string | null) => string;
  windowLeft: (label: string, percent: number, reset: string | null) => string;
  resetsIn: (parts: ResetParts) => string;
  resettingSoon: string;
  ago: AgeText;
  fromHud: string;
  fromApi: string;
  fromMagpie: string;
  fromCodex: string;
  fromGlm: string;
  fromKimi: string;
  updated: (ago: string, source: string) => string;
  staleUpdated: (ago: string, source: string) => string;
  staleReason: Partial<Record<"hud" | "codex", string>>;
  ringLabel: (details: string) => string;
  noData: string;
  noUsage: Record<"codex" | "glm" | "kimi", string>;
  windowNames: Record<string, string>;
  planErrors: Record<AgentUsageErrorKind, string>;
  errors: Record<AgentUsageErrorKind, string>;
  needsAgents: string;
  settings: {
    title: string;
    footer: string;
    codexHint: string;
    glmHint: string;
    glmHintMac: string;
    kimiHint: string;
    kimiHintMac: string;
    show: string;
    used: string;
    remaining: string;
    askAnthropic: string;
    askAnthropicHint: string;
    proxy: string;
    proxyHint: string;
    proxyHintMac: string;
    interval: string;
    minutes: string;
  };
  keys: {
    label: (name: string) => string;
    savedPlaceholder: string;
    emptyPlaceholder: string;
    save: string;
    clear: string;
    saved: string;
    notSaved: string;
  };
};

export const zhCN: ClaudeUsageText = {
  fiveHour: "5 小时",
  sevenDay: "7 天",
  window: (label, percent, reset) => (reset ? `${label} ${percent}% · ${reset}` : `${label} ${percent}%`),
  windowLeft: (label, percent, reset) => (reset ? `${label} 剩余 ${percent}% · ${reset}` : `${label} 剩余 ${percent}%`),
  resetsIn: ({ days, hours, minutes }) =>
    days > 0 ? `${days} 天 ${hours} 小时后重置` : hours > 0 ? `${hours} 小时 ${minutes} 分后重置` : `${minutes} 分后重置`,
  resettingSoon: "即将重置",
  ago: commonZhCN.ago,
  fromHud: "来自 claude-hud",
  fromApi: "来自 Anthropic",
  fromMagpie: "来自 magpie",
  fromCodex: "来自 Codex 会话记录",
  fromGlm: "来自智谱开放平台",
  fromKimi: "来自 Kimi",
  updated: (ago, source) => `${ago}更新 · ${source}`,
  staleUpdated: (ago, source) => `可能已过时：${ago}更新 · ${source}`,
  staleReason: {
    hud: "claude-hud 只在终端里的 Claude Code 刷新状态栏时写这份快照，用一下 Claude Code 就会更新",
    codex: "Codex 跑完一轮才会写入新的额度",
  },
  ringLabel: (details) => `用量：${details}。点击刷新`,
  noData: "暂无 Claude 用量（需要本机的 magpie 网关、claude-hud 的用量快照，或在设置 → AI Agent 的用量环里打开「直接向 Anthropic 查询」）",
  noUsage: {
    codex: "暂无 Codex 用量（Codex 跑过一轮后，会话记录里才有额度）",
    glm: "暂无 GLM 用量（在设置 → AI Agent 的用量环里保存 GLM Coding Plan 的 API Key）",
    kimi: "暂无 Kimi 用量（在设置 → AI Agent 的用量环里保存 Kimi Code 的 API Key）",
  },
  windowNames: { month: "本月", mcpMonth: "MCP 本月" },
  planErrors: {
    noCredentials: "还没有保存 API Key，请在设置 → AI Agent 的用量环里填写",
    tokenExpired: "API Key 已过期，请在设置 → AI Agent 的用量环里重新保存",
    loginRequired: "API Key 无效或已过期，请在设置 → AI Agent 的用量环里重新保存",
    forbidden: "这个 API Key 没有 Coding Plan 套餐",
    rateLimited: "请求过于频繁，稍后自动重试",
    noProxy: "没有代理",
    network: "无法连接服务商",
    http: "服务商返回了错误",
    invalidResponse: "无法识别服务商返回的用量",
  },
  needsAgents: "需要打开 AI Agent 插件",
  settings: {
    title: "用量环",
    footer: "在收起条上给下面打开的每个 Agent 一个同心双环：外环 5 小时，内环 7 天（没有周限额的套餐显示本月），悬停显示详情，点击刷新。每家一种颜色，用到 70% 和 90% 时统一变黄、变红。Claude Code 默认读 claude-hud 写出的用量快照，不联网、不读登录凭据；Claude Code 和 Codex 的用量要打开 AI Agent。",
    codexHint: "读本机 Codex 会话记录里的额度（CODEX_HOME 或 ~/.codex 下的 sessions），不联网。Codex 跑过一轮后才有数据。",
    glmHint: "用下面保存的智谱开放平台 API Key，每分钟最多一次直连 open.bigmodel.cn 查询 GLM Coding Plan 的 5 小时、每周和 MCP 月度额度。Key 存在 Windows 凭据管理器里，只发给智谱。",
    glmHintMac: "用下面保存的智谱开放平台 API Key，每分钟最多一次直连 open.bigmodel.cn 查询 GLM Coding Plan 的 5 小时、每周和 MCP 月度额度。Key 存在钥匙串里，只发给智谱。",
    kimiHint: "用下面保存的 Kimi Code API Key，每分钟最多一次直连 api.kimi.com 查询 5 小时、每周或本月额度。Key 存在 Windows 凭据管理器里，只发给 Kimi。",
    kimiHintMac: "用下面保存的 Kimi Code API Key，每分钟最多一次直连 api.kimi.com 查询 5 小时、每周或本月额度。Key 存在钥匙串里，只发给 Kimi。",
    show: "环和悬停卡片显示",
    used: "已用",
    remaining: "剩余",
    askAnthropic: "Claude Code：直接向 Anthropic 查询",
    askAnthropicHint: "打开后读取本机 Claude Code 保存的登录令牌（~/.claude/.credentials.json，只读，不刷新、不改写，也不会发给 Anthropic 以外的地方），按下面的间隔经代理请求 api.anthropic.com 的用量接口。这个接口没有公开文档，可能随时失效，失效时退回 claude-hud 的快照。Agent 页顶部的用量也会用这份数据。",
    proxy: "代理地址",
    proxyHint: "http:// 或 https:// 代理，例如 http://127.0.0.1:7890。留空时依次用 HTTPS_PROXY 环境变量和 Windows 的系统代理；都没有就不请求，不会绕过代理直连。",
    proxyHintMac: "http:// 或 https:// 代理，例如 http://127.0.0.1:7890。留空时用 HTTPS_PROXY 环境变量；没有就不请求，不会绕过代理直连。",
    interval: "刷新间隔",
    minutes: "分钟",
  },
  keys: {
    label: (name) => `${name} API Key`,
    savedPlaceholder: "已保存，粘贴新的 Key 可替换",
    emptyPlaceholder: "粘贴 API Key",
    save: "保存",
    clear: "删除",
    saved: "已保存",
    notSaved: "未保存",
  },
  errors: {
    noCredentials: "未找到 Claude Code 的订阅登录，请先在 Claude Code 里登录",
    tokenExpired: "登录已过期，打开 Claude Code 以刷新登录",
    loginRequired: "需要在 Claude Code 里重新登录",
    forbidden: "当前登录无权读取用量，可尝试在 Claude Code 里重新登录",
    rateLimited: "请求过于频繁，稍后自动重试",
    noProxy: "没有代理：请在设置 → AI Agent 的用量环里填写代理地址",
    network: "无法通过代理连接 Anthropic",
    http: "Anthropic 返回了错误",
    invalidResponse: "无法识别 Anthropic 返回的用量",
  },
};

export const en: ClaudeUsageText = {
  fiveHour: "5h",
  sevenDay: "7d",
  window: (label, percent, reset) => (reset ? `${label} ${percent}% · ${reset}` : `${label} ${percent}%`),
  windowLeft: (label, percent, reset) => (reset ? `${label} ${percent}% left · ${reset}` : `${label} ${percent}% left`),
  resetsIn: ({ days, hours, minutes }) =>
    days > 0 ? `resets in ${days}d ${hours}h` : hours > 0 ? `resets in ${hours}h ${minutes}m` : `resets in ${minutes}m`,
  resettingSoon: "resetting soon",
  ago: commonEn.ago,
  fromHud: "via claude-hud",
  fromApi: "from Anthropic",
  fromMagpie: "from magpie",
  fromCodex: "from Codex's session logs",
  fromGlm: "from Zhipu's open platform",
  fromKimi: "from Kimi",
  updated: (ago, source) => `updated ${ago} · ${source}`,
  staleUpdated: (ago, source) => `May be stale: updated ${ago} · ${source}`,
  staleReason: {
    hud: "claude-hud writes this snapshot only when Claude Code redraws its status line in a terminal; use Claude Code once to refresh it",
    codex: "Codex writes new limits only after it finishes a turn",
  },
  ringLabel: (details) => `Usage: ${details}. Click to refresh`,
  noData: "No Claude usage yet (needs a local magpie gateway, claude-hud's usage snapshot, or \"Ask Anthropic directly\" under Settings → AI Agent → Usage rings)",
  noUsage: {
    codex: "No Codex usage yet (Codex's session logs carry it after a turn)",
    glm: "No GLM usage yet (save a GLM Coding Plan API key under Settings → AI Agent → Usage rings)",
    kimi: "No Kimi usage yet (save a Kimi Code API key under Settings → AI Agent → Usage rings)",
  },
  windowNames: { month: "Month", mcpMonth: "MCP month" },
  planErrors: {
    noCredentials: "No API key saved; add one under Settings → AI Agent → Usage rings",
    tokenExpired: "The API key expired; save it again under Settings → AI Agent → Usage rings",
    loginRequired: "The API key is invalid or expired; save it again under Settings → AI Agent → Usage rings",
    forbidden: "This API key has no coding plan",
    rateLimited: "Rate limited; retrying later",
    noProxy: "No proxy",
    network: "Can't reach the provider",
    http: "The provider returned an error",
    invalidResponse: "Unrecognized usage answer from the provider",
  },
  needsAgents: "Needs the AI Agent plugin switched on",
  settings: {
    title: "Usage rings",
    footer: "Gives each agent switched on below two rings on the collapsed bar: 5 hours outside, 7 days inside (the month for plans without a weekly limit), with details on hover and a refresh on click. Each has its own colour until 70% and 90% turn any of them yellow and red. Claude Code reads the usage snapshot claude-hud writes by default, with no network access and no login credentials; Claude Code and Codex need AI Agent switched on.",
    codexHint: "Reads the limits in Codex's session logs on this computer (sessions under CODEX_HOME or ~/.codex), with no network access. Numbers appear after Codex has run a turn.",
    glmHint: "Asks open.bigmodel.cn directly, at most once a minute, for the GLM Coding Plan's 5-hour, weekly and monthly MCP limits with the Zhipu open platform API key saved below. The key lives in the Windows Credential Manager and goes to Zhipu only.",
    glmHintMac: "Asks open.bigmodel.cn directly, at most once a minute, for the GLM Coding Plan's 5-hour, weekly and monthly MCP limits with the Zhipu open platform API key saved below. The key lives in the keychain and goes to Zhipu only.",
    kimiHint: "Asks api.kimi.com directly, at most once a minute, for the 5-hour, weekly or monthly limits with the Kimi Code API key saved below. The key lives in the Windows Credential Manager and goes to Kimi only.",
    kimiHintMac: "Asks api.kimi.com directly, at most once a minute, for the 5-hour, weekly or monthly limits with the Kimi Code API key saved below. The key lives in the keychain and goes to Kimi only.",
    show: "Rings and card show",
    used: "Used",
    remaining: "Left",
    askAnthropic: "Claude Code: ask Anthropic directly",
    askAnthropicHint: "When on, the island reads the login token Claude Code saved on this computer (~/.claude/.credentials.json; read only, never renewed or rewritten, sent nowhere but Anthropic) and asks api.anthropic.com's usage endpoint through a proxy at the interval below. The endpoint is undocumented and may stop working at any time; the island then falls back to claude-hud's snapshot. The Agent page's usage line uses these numbers too.",
    proxy: "Proxy",
    proxyHint: "An http:// or https:// proxy, such as http://127.0.0.1:7890. Empty uses the HTTPS_PROXY environment variable, then the Windows proxy; without either nothing is sent, never directly.",
    proxyHintMac: "An http:// or https:// proxy, such as http://127.0.0.1:7890. Empty uses the HTTPS_PROXY environment variable; without it nothing is sent, never directly.",
    interval: "Refresh every",
    minutes: "min",
  },
  keys: {
    label: (name) => `${name} API key`,
    savedPlaceholder: "Saved; paste a new key to replace it",
    emptyPlaceholder: "Paste an API key",
    save: "Save",
    clear: "Remove",
    saved: "Saved",
    notSaved: "Not saved",
  },
  errors: {
    noCredentials: "No Claude Code subscription login found; sign in to Claude Code first",
    tokenExpired: "Login expired; open Claude Code to renew it",
    loginRequired: "Sign in again in Claude Code",
    forbidden: "This login may not read usage; try signing in again in Claude Code",
    rateLimited: "Rate limited; retrying later",
    noProxy: "No proxy; set one under Settings → AI Agent → Usage rings",
    network: "Can't reach Anthropic through the proxy",
    http: "Anthropic returned an error",
    invalidResponse: "Unrecognized usage answer from Anthropic",
  },
};
