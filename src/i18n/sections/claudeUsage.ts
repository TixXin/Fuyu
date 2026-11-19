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
  fromAntigravity: string;
  fromAntigravityCloud: string;
  fromCursor: string;
  fromWorkbuddy: string;
  fromDshApi: string;
  fromDshAccount: string;
  updated: (ago: string, source: string) => string;
  staleUpdated: (ago: string, source: string) => string;
  staleReason: Partial<Record<"hud" | "codex", string>>;
  ringLabel: (details: string) => string;
  hoverOnlyLabel: (details: string) => string;
  hoverOnlyItemName: string;
  noData: string;
  noUsage: Record<"codex" | "antigravity" | "glm" | "kimi" | "cursor" | "workbuddy" | "dsh", string>;
  windowNames: Record<string, string>;
  workbuddyCredits: (today: number, sevenDay: number, total: number, totalTokens: number) => string;
  dshWallet: (currency: string, total: string, toppedUp: string, granted: string) => string;
  dshEmpty: string;
  planErrors: Record<AgentUsageErrorKind, string>;
  antigravityErrors: Record<AgentUsageErrorKind, string>;
  cursorErrors: Record<AgentUsageErrorKind, string>;
  workbuddyErrors: Record<AgentUsageErrorKind, string>;
  dshErrors: Record<AgentUsageErrorKind, string>;
  errors: Record<AgentUsageErrorKind, string>;
  needsAgents: string;
  settings: {
    title: string;
    optionsTitle: string;
    footer: string;
    codexHint: string;
    antigravityHint: string;
    glmHint: string;
    glmHintMac: string;
    kimiHint: string;
    kimiHintMac: string;
    cursorHint: string;
    workbuddyHint: string;
    dshHint: string;
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

function formatCredit(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function formatTokenShort(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(tokens);
}

function currencySymbol(currency: string): string {
  if (currency === "CNY") return "¥";
  if (currency === "USD") return "$";
  return `${currency} `;
}

function hasNonZeroAmount(amount: string): boolean {
  const num = Number(amount);
  return Number.isFinite(num) && num > 0;
}

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
  fromAntigravity: "来自 Antigravity 本地服务",
  fromAntigravityCloud: "来自 Antigravity 云端",
  fromCursor: "来自 Cursor",
  fromWorkbuddy: "来自 WorkBuddy 会话记录",
  fromDshApi: "来自 DeepSeek 开放平台",
  fromDshAccount: "来自 DeepSeek 账户",
  updated: (ago, source) => `${ago}更新 · ${source}`,
  staleUpdated: (ago, source) => `可能已过时：${ago}更新 · ${source}`,
  staleReason: {
    hud: "claude-hud 只在终端里的 Claude Code 刷新状态栏时写这份快照，用一下 Claude Code 就会更新",
    codex: "Codex 跑完一轮才会写入新的额度",
  },
  ringLabel: (details) => `用量：${details}。点击刷新`,
  hoverOnlyLabel: (details) => `余量详情：${details}。点击刷新`,
  hoverOnlyItemName: "余量悬停",
  noData: "暂无 Claude 用量（需要本机的 magpie 网关、claude-hud 的用量快照，或在设置 → AI Agent 的用量环里打开「直接向 Anthropic 查询」）",
  noUsage: {
    codex: "暂无 Codex 用量（Codex 跑过一轮后，会话记录里才有额度）",
    antigravity: "暂无 Antigravity 用量（请打开 Antigravity 或先在 Antigravity 中登录）",
    glm: "暂无 GLM 用量（在设置 → AI Agent 的用量环里保存 GLM Coding Plan 的 API Key）",
    kimi: "暂无 Kimi 用量（在设置 → AI Agent 的用量环里保存 Kimi Code 的 API Key）",
    cursor: "暂无 Cursor 用量（请先在 Cursor 中登录）",
    workbuddy: "暂无 WorkBuddy 积分记录（运行过 WorkBuddy 会话后自动统计）",
    dsh: "暂无 DeepSeek Harness 余额（需要先在 DSH 中登录或配置官方 API Key）",
  },
  windowNames: {
    month: "本月",
    mcpMonth: "MCP 本月",
    "3p5h": "Claude / GPT 5 小时",
    "3p7d": "Claude / GPT 7 天",
    cursorAuto: "Auto 本月",
    cursorApi: "指定模型本月",
  },
  workbuddyCredits: (today, sevenDay, total, totalTokens) => {
    if (total === 0 && totalTokens > 0) {
      return `已用 0 积分（累计 ${formatTokenShort(totalTokens)} tokens）`;
    }
    return `今日已用 ${formatCredit(today)} 积分 · 7 天 ${formatCredit(sevenDay)} 积分（累计 ${formatCredit(total)}）`;
  },
  dshWallet: (currency, total, toppedUp, granted) => {
    const sym = currencySymbol(currency);
    return hasNonZeroAmount(granted)
      ? `余额 ${sym}${total}（充值 ${sym}${toppedUp} · 赠送 ${sym}${granted}）`
      : `余额 ${sym}${total}`;
  },
  dshEmpty: "余额不足，当前不可用",
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
    endpointChanged: "接口失效",
    noSessions: "未找到会话记录",
    customEndpoint: "当前使用自定义接口，无法查询官方额度",
  },
  antigravityErrors: {
    noCredentials: "Antigravity 未运行，且未找到本机登录凭据",
    tokenExpired: "Antigravity 登录已过期，打开 Antigravity 后会自动刷新",
    loginRequired: "Antigravity 登录状态已失效，请重新登录",
    forbidden: "当前账号无权读取 Antigravity 配额",
    rateLimited: "请求过于频繁，稍后自动重试",
    noProxy: "没有代理",
    network: "无法连接 Antigravity 配额服务",
    http: "Antigravity 配额服务返回了错误",
    invalidResponse: "接口失效（无法识别 Antigravity 返回的配额格式）",
    endpointChanged: "接口失效（Antigravity 的内部配额接口可能已随版本变更）",
    noSessions: "未找到 Antigravity 会话",
    customEndpoint: "使用了非官方端点",
  },
  cursorErrors: {
    noCredentials: "未找到 Cursor 的登录",
    tokenExpired: "Cursor 登录已过期，打开 Cursor 后会自动刷新",
    loginRequired: "Cursor 登录已失效，打开 Cursor 或重新登录",
    forbidden: "当前账号无权读取 Cursor 用量",
    rateLimited: "请求过于频繁，稍后自动重试",
    noProxy: "没有代理",
    network: "无法连接 Cursor",
    http: "Cursor 返回了错误",
    invalidResponse: "接口失效（无法识别 Cursor 返回的用量）",
    endpointChanged: "接口失效（Cursor 的内部用量接口可能已随版本变更）",
    noSessions: "未找到 Cursor 会话",
    customEndpoint: "使用了自定义接口",
  },
  workbuddyErrors: {
    noCredentials: "未找到 WorkBuddy 数据",
    tokenExpired: "登录已过期",
    loginRequired: "需要登录 WorkBuddy",
    forbidden: "无法读取 WorkBuddy 记录",
    rateLimited: "读取受限",
    noProxy: "没有代理",
    network: "读取失败",
    http: "读取失败",
    invalidResponse: "无法识别 WorkBuddy 会话记录中的积分字段",
    endpointChanged: "WorkBuddy 记录格式已变更",
    noSessions: "未找到 WorkBuddy 会话记录，运行一次会话后即可统计积分",
    customEndpoint: "使用了自定义模型接口",
  },
  dshErrors: {
    noCredentials: "未在 DSH 的 .credentials.yaml 中找到官方 API Key 或账户登录",
    tokenExpired: "DSH 登录令牌已过期，请打开 DSH 刷新登录",
    loginRequired: "DSH 的 API Key 或账户登录已失效，请在 DSH 中更新",
    forbidden: "当前凭据无权查询 DeepSeek 余额",
    rateLimited: "请求过于频繁，稍后自动重试",
    noProxy: "没有代理",
    network: "无法连接 DeepSeek 查询余额",
    http: "DeepSeek 余额服务返回了错误",
    invalidResponse: "无法识别 DeepSeek 返回的余额格式",
    endpointChanged: "DeepSeek 余额接口已变更",
    noSessions: "未找到 DeepSeek Harness 会话或凭据目录",
    customEndpoint: "当前 DSH 使用自定义模型或网关，无法查询 DeepSeek 官方余额",
  },
  needsAgents: "需要打开 AI Agent 插件",
  settings: {
    title: "用量环",
    optionsTitle: "显示口径与直连查询",
    footer: "在收起条上给有额度窗口的 Agent 显示同心双环（外环 5 小时，内环 7 天或本月），悬停显示详情，点击刷新；用到 70% 和 90% 时统一变黄、变红。WorkBuddy 和 DeepSeek Harness 没有百分比窗口，不画圆环，只在悬停卡片中显示已用积分或账户余额。联网查询项默认均关闭，凭据只在 Rust 进程内存中使用。",
    codexHint: "读本机 Codex 会话记录里的额度（CODEX_HOME 或 ~/.codex 下的 sessions），不联网。Codex 跑过一轮后才有数据。",
    antigravityHint: "优先查询本机运行中的 Antigravity 本地服务，未运行时只读 ~/.gemini 下的登录令牌向 Cloud Code 查询 Gemini 与 Claude / GPT 的 5 小时和每周额度。这是未公开的内部接口，随版本可能失效（失效时提示「接口失效」）。",
    glmHint: "用下面保存的智谱开放平台 API Key，每分钟最多一次直连 open.bigmodel.cn 查询 GLM Coding Plan 的 5 小时、每周和 MCP 月度额度。Key 存在 Windows 凭据管理器里，只发给智谱。",
    glmHintMac: "用下面保存的智谱开放平台 API Key，每分钟最多一次直连 open.bigmodel.cn 查询 GLM Coding Plan 的 5 小时、每周和 MCP 月度额度。Key 存在钥匙串里，只发给智谱。",
    kimiHint: "用下面保存的 Kimi Code API Key，每分钟最多一次直连 api.kimi.com 查询 5 小时、每周或本月额度。Key 存在 Windows 凭据管理器里，只发给 Kimi。",
    kimiHintMac: "用下面保存的 Kimi Code API Key，每分钟最多一次直连 api.kimi.com 查询 5 小时、每周或本月额度。Key 存在钥匙串里，只发给 Kimi。",
    cursorHint: "只读本机 Cursor 保存的登录（state.vscdb，不刷新、不改写），最多每 5 分钟一次直连 api2.cursor.sh 查询本计费周期已用的比例（内环本月）。这是未公开的内部接口，随版本可能失效。没装 Cursor、没登录或查不到时不显示这个环。",
    workbuddyHint: "只读本机 ~/.workbuddy 与 ~/.workbuddy-ai 会话记录中的积分消耗（不联网、不进圆环），在用量环悬停卡片中显示今日、近 7 天与累计已用积分。",
    dshHint: "只读本机 DeepSeek Harness 的 .credentials.yaml（仅在官方默认路由下生效，凭据只在内存中使用，不进圆环），每分钟最多一次查询官方账户或 API 余额并在悬停卡片中显示。",
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
    endpointChanged: "接口失效",
    noSessions: "未找到会话记录",
    customEndpoint: "使用了自定义接口",
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
  fromAntigravity: "from Antigravity's local server",
  fromAntigravityCloud: "from Antigravity Cloud Code",
  fromCursor: "from Cursor",
  fromWorkbuddy: "from WorkBuddy's session logs",
  fromDshApi: "from DeepSeek API",
  fromDshAccount: "from DeepSeek account",
  updated: (ago, source) => `updated ${ago} · ${source}`,
  staleUpdated: (ago, source) => `May be stale: updated ${ago} · ${source}`,
  staleReason: {
    hud: "claude-hud writes this snapshot only when Claude Code redraws its status line in a terminal; use Claude Code once to refresh it",
    codex: "Codex writes new limits only after it finishes a turn",
  },
  ringLabel: (details) => `Usage: ${details}. Click to refresh`,
  hoverOnlyLabel: (details) => `Balances: ${details}. Click to refresh`,
  hoverOnlyItemName: "Usage hover",
  noData: "No Claude usage yet (needs a local magpie gateway, claude-hud's usage snapshot, or \"Ask Anthropic directly\" under Settings → AI Agent → Usage rings)",
  noUsage: {
    codex: "No Codex usage yet (Codex's session logs carry it after a turn)",
    antigravity: "No Antigravity usage yet (open Antigravity or sign in first)",
    glm: "No GLM usage yet (save a GLM Coding Plan API key under Settings → AI Agent → Usage rings)",
    kimi: "No Kimi usage yet (save a Kimi Code API key under Settings → AI Agent → Usage rings)",
    cursor: "No Cursor usage yet (sign in to Cursor first)",
    workbuddy: "No WorkBuddy credit records yet (counted once WorkBuddy runs a session)",
    dsh: "No DeepSeek Harness balance yet (sign in or set an official API key in DSH first)",
  },
  windowNames: {
    month: "Month",
    mcpMonth: "MCP month",
    "3p5h": "Claude / GPT 5h",
    "3p7d": "Claude / GPT 7d",
    cursorAuto: "Auto this month",
    cursorApi: "Named models this month",
  },
  workbuddyCredits: (today, sevenDay, total, totalTokens) => {
    if (total === 0 && totalTokens > 0) {
      return `0 credits used (${formatTokenShort(totalTokens)} tokens logged)`;
    }
    return `Today ${formatCredit(today)} credits · 7d ${formatCredit(sevenDay)} (${formatCredit(total)} total)`;
  },
  dshWallet: (currency, total, toppedUp, granted) => {
    const sym = currencySymbol(currency);
    return hasNonZeroAmount(granted)
      ? `Balance ${sym}${total} (topped up ${sym}${toppedUp} · granted ${sym}${granted})`
      : `Balance ${sym}${total}`;
  },
  dshEmpty: "Balance depleted",
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
    endpointChanged: "Endpoint unavailable",
    noSessions: "No session records found",
    customEndpoint: "Custom endpoint configured; official quota unavailable",
  },
  antigravityErrors: {
    noCredentials: "Antigravity isn't running and has no saved login token",
    tokenExpired: "Antigravity login expired; open Antigravity to refresh it",
    loginRequired: "Antigravity login is no longer valid; sign in again",
    forbidden: "This account may not read Antigravity quota",
    rateLimited: "Rate limited; retrying later",
    noProxy: "No proxy",
    network: "Can't reach Antigravity's quota service",
    http: "Antigravity's quota service returned an error",
    invalidResponse: "Endpoint changed (unrecognized Antigravity quota format)",
    endpointChanged: "Endpoint changed (Antigravity's internal quota API may have changed)",
    noSessions: "No Antigravity sessions found",
    customEndpoint: "Non-official endpoint configured",
  },
  cursorErrors: {
    noCredentials: "No Cursor login found",
    tokenExpired: "Cursor login expired; open Cursor to refresh it",
    loginRequired: "Cursor login is no longer valid; open Cursor or sign in again",
    forbidden: "This account may not read Cursor usage",
    rateLimited: "Rate limited; retrying later",
    noProxy: "No proxy",
    network: "Can't reach Cursor",
    http: "Cursor returned an error",
    invalidResponse: "Endpoint changed (unrecognized Cursor usage format)",
    endpointChanged: "Endpoint changed (Cursor's internal usage API may have changed)",
    noSessions: "No Cursor sessions found",
    customEndpoint: "Uses a custom endpoint",
  },
  workbuddyErrors: {
    noCredentials: "No WorkBuddy data found",
    tokenExpired: "Login expired",
    loginRequired: "Sign in to WorkBuddy",
    forbidden: "Cannot read WorkBuddy logs",
    rateLimited: "Rate limited",
    noProxy: "No proxy",
    network: "Could not read logs",
    http: "Could not read logs",
    invalidResponse: "Unrecognized credit format in WorkBuddy's session logs",
    endpointChanged: "WorkBuddy log format changed",
    noSessions: "No WorkBuddy session logs found yet; run a session first",
    customEndpoint: "Custom model endpoint configured",
  },
  dshErrors: {
    noCredentials: "No DeepSeek API key or account login in DSH's .credentials.yaml",
    tokenExpired: "DSH login token expired; open DSH to refresh it",
    loginRequired: "DSH API key or login expired; update it in DSH",
    forbidden: "This credential cannot read the DeepSeek balance",
    rateLimited: "Rate limited; retrying later",
    noProxy: "No proxy",
    network: "Can't reach DeepSeek to check the balance",
    http: "DeepSeek's balance service returned an error",
    invalidResponse: "Unrecognized balance answer from DeepSeek",
    endpointChanged: "DeepSeek balance endpoint changed",
    noSessions: "No DeepSeek Harness sessions or credentials found",
    customEndpoint: "DSH uses a custom model or gateway; official DeepSeek balance unavailable",
  },
  needsAgents: "Needs the AI Agent plugin switched on",
  settings: {
    title: "Usage rings",
    optionsTitle: "Display and direct query",
    footer: "Gives each agent with quota windows two rings on the collapsed bar (5 hours outside, 7 days or the month inside), with details on hover and a refresh on click; 70% and 90% turn yellow and red. WorkBuddy and DeepSeek Harness have no percentage windows, so they stay out of the rings and show credits or wallet balance on hover. Network lookups default to off and credentials stay in Rust memory.",
    codexHint: "Reads the limits in Codex's session logs on this computer (sessions under CODEX_HOME or ~/.codex), with no network access. Numbers appear after Codex has run a turn.",
    antigravityHint: "Queries the running local Antigravity server first, or falls back to ~/.gemini login tokens (read-only) to ask Cloud Code for Gemini and Claude / GPT 5-hour and weekly limits. Uses undocumented internal endpoints that may break across updates (reported as \"Endpoint changed\").",
    glmHint: "Asks open.bigmodel.cn directly, at most once a minute, for the GLM Coding Plan's 5-hour, weekly and monthly MCP limits with the Zhipu open platform API key saved below. The key lives in the Windows Credential Manager and goes to Zhipu only.",
    glmHintMac: "Asks open.bigmodel.cn directly, at most once a minute, for the GLM Coding Plan's 5-hour, weekly and monthly MCP limits with the Zhipu open platform API key saved below. The key lives in the keychain and goes to Zhipu only.",
    kimiHint: "Asks api.kimi.com directly, at most once a minute, for the 5-hour, weekly or monthly limits with the Kimi Code API key saved below. The key lives in the Windows Credential Manager and goes to Kimi only.",
    kimiHintMac: "Asks api.kimi.com directly, at most once a minute, for the 5-hour, weekly or monthly limits with the Kimi Code API key saved below. The key lives in the keychain and goes to Kimi only.",
    cursorHint: "Reads the login Cursor saved on this computer (state.vscdb, read-only, never refreshed or rewritten) and asks api2.cursor.sh directly, at most every 5 minutes, how much of this billing cycle is used (inner ring: this month). Uses an undocumented internal endpoint that may break across updates. The ring stays hidden when Cursor isn't installed, isn't signed in or has no usage.",
    workbuddyHint: "Reads credit consumption from local ~/.workbuddy and ~/.workbuddy-ai session logs (offline, not shown as a ring) and lists today's, 7-day and total credits in the hover card.",
    dshHint: "Reads DeepSeek Harness's local .credentials.yaml (official default routes only; credentials stay in Rust memory, not shown as a ring) to query the official wallet balance at most once a minute for the hover card.",
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
    endpointChanged: "Endpoint unavailable",
    noSessions: "No session records found",
    customEndpoint: "Custom endpoint configured",
  },
};
