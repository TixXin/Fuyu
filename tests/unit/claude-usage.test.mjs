import assert from "node:assert/strict";
import test from "node:test";
import { USAGE_STALE_MS } from "../../src/lib/agent-usage/usage.ts";
import {
  HIDDEN_WITHOUT_NUMBERS,
  HOVER_USAGE_PROVIDERS,
  hasUsageNumbers,
  USAGE_COLORS,
  USAGE_PROVIDERS,
  hoverProviderLines,
  isUsageStale,
  needsHoverOnlyGauge,
  shownHoverProviders,
  shownUsageProviders,
  usageCardLines,
  usageColor,
  usageRings,
} from "../../src/features/claude-usage/usageRing.ts";
import { en, zhCN } from "../../src/i18n/sections/claudeUsage.ts";

const NOW = Date.parse("2026-11-06T08:00:00Z");
const MINUTE = 60_000;

function usage(overrides = {}) {
  return {
    updatedAt: NOW - MINUTE,
    fiveHour: { name: "", used: 42.4, resetsAt: NOW + (2 * 60 + 13) * MINUTE },
    sevenDay: { name: "", used: 17, resetsAt: NOW + (3 * 1440 + 4 * 60) * MINUTE },
    models: [],
    plan: "Max 20x",
    ...overrides,
  };
}
const texts = (lines) => lines.map((line) => line.text);

test("ring colour follows the thresholds and turns grey when stale", () => {
  assert.equal(usageColor(0, false), USAGE_COLORS.normal);
  assert.equal(usageColor(69.9, false), USAGE_COLORS.normal);
  assert.equal(usageColor(70, false), USAGE_COLORS.warn);
  assert.equal(usageColor(90, false), USAGE_COLORS.danger);
  assert.equal(usageColor(100, true), USAGE_COLORS.stale);
});

test("no snapshot or an old one is stale; one without a write time is not", () => {
  assert.equal(isUsageStale(usage(), NOW), false);
  assert.equal(isUsageStale(usage({ updatedAt: NOW - USAGE_STALE_MS - 1 }), NOW), true);
  assert.equal(isUsageStale(usage({ updatedAt: null }), NOW), false);
  assert.equal(isUsageStale(null, NOW), true);
});

test("rings: 5 hours outside, 7 days inside, bare grey tracks without a snapshot", () => {
  assert.deepEqual(usageRings(usage(), NOW), [
    { value: 0.424, color: USAGE_COLORS.normal },
    { value: 0.17, color: USAGE_COLORS.normal },
  ]);
  assert.deepEqual(usageRings(usage({ fiveHour: { name: "", used: 95, resetsAt: null }, updatedAt: NOW - 20 * MINUTE }), NOW)[0], { value: 0.95, color: USAGE_COLORS.stale });
  assert.deepEqual(usageRings(null, NOW), [{ value: 0, color: USAGE_COLORS.stale }, { value: 0, color: USAGE_COLORS.stale }]);
  assert.deepEqual(usageRings(usage({ sevenDay: null }), NOW)[1], { value: 0, color: USAGE_COLORS.stale });
});

test("card lists both windows with countdowns, then the snapshot's age", () => {
  const lines = usageCardLines(usage(), NOW, zhCN);
  assert.deepEqual(texts(lines), ["5 小时 42% · 2 小时 13 分后重置", "7 天 17% · 3 天 4 小时后重置", "1 分钟前更新 · 来自 claude-hud"]);
  assert.equal(lines[0].color, USAGE_COLORS.normal);
  assert.equal(lines[2].muted, true);
  assert.deepEqual(texts(usageCardLines(usage(), NOW, en)), ["5h 42% · resets in 2h 13m", "7d 17% · resets in 3d 4h", "updated 1 min ago · via claude-hud"]);
});

test("remaining fills the rings with what is left and says so, colour still by what is used", () => {
  const u = usage({ fiveHour: { name: "", used: 92, resetsAt: NOW + (2 * 60 + 13) * MINUTE } });
  const [outer, inner] = usageRings(u, NOW, true);
  assert.ok(Math.abs(outer.value - 0.08) < 1e-9);
  assert.equal(outer.color, USAGE_COLORS.danger);
  assert.equal(inner.value, 0.83);
  assert.deepEqual(texts(usageCardLines(u, NOW, zhCN, true)).slice(0, 2), ["5 小时 剩余 8% · 2 小时 13 分后重置", "7 天 剩余 83% · 3 天 4 小时后重置"]);
  assert.deepEqual(texts(usageCardLines(u, NOW, en, true)).slice(0, 1), ["5h 8% left · resets in 2h 13m"]);
  assert.deepEqual(usageRings(usage({ fiveHour: { name: "", used: 104, resetsAt: null } }), NOW, true)[0].value, 0);
});

test("card handles missing reset times, past resets and missing snapshots", () => {
  const lines = usageCardLines(usage({
    fiveHour: { name: "", used: 99.6, resetsAt: NOW + 5 * MINUTE },
    sevenDay: { name: "", used: 3, resetsAt: null },
  }), NOW, zhCN);
  assert.deepEqual(texts(lines).slice(0, 2), ["5 小时 100% · 5 分后重置", "7 天 3%"]);
  assert.equal(lines[0].color, USAGE_COLORS.danger);
  const past = usageCardLines(usage({ fiveHour: { name: "", used: 1, resetsAt: NOW - MINUTE }, sevenDay: null }), NOW, en);
  assert.equal(past[0].text, "5h 1% · resetting soon");
  assert.deepEqual(texts(usageCardLines(usage({ updatedAt: NOW - 3 * 60 * MINUTE }), NOW, en)).slice(2), ["May be stale: updated 3 h ago · via claude-hud", en.staleReason.hud]);
  assert.deepEqual(texts(usageCardLines(null, NOW, en)), [en.noData]);
  assert.deepEqual(texts(usageCardLines(usage({ fiveHour: null, sevenDay: null, updatedAt: null }), NOW, en)), [en.noData]);
});

test("asking Anthropic directly: its numbers name the source, its failures add a line", () => {
  assert.deepEqual(texts(usageCardLines(usage({ source: "api" }), NOW, zhCN)).slice(2), ["1 分钟前更新 · 来自 Anthropic"]);
  assert.deepEqual(texts(usageCardLines(usage({ source: "magpie" }), NOW, en)).slice(2), ["updated 1 min ago · from magpie"]);
  const failed = usageCardLines(usage({ source: "hud", error: { kind: "loginRequired", message: "" } }), NOW, zhCN);
  assert.deepEqual(texts(failed).slice(2), ["需要在 Claude Code 里重新登录", "1 分钟前更新 · 来自 claude-hud"]);
  assert.equal(failed[0].color, USAGE_COLORS.normal);
  const empty = usage({ fiveHour: null, sevenDay: null, updatedAt: null, error: { kind: "noProxy", message: "" } });
  assert.deepEqual(texts(usageCardLines(empty, NOW, en)), [en.noData, en.errors.noProxy]);
  for (const kind of [
    "noCredentials",
    "tokenExpired",
    "loginRequired",
    "forbidden",
    "rateLimited",
    "noProxy",
    "network",
    "http",
    "invalidResponse",
    "endpointChanged",
    "noSessions",
    "customEndpoint",
  ]) {
    assert.ok(zhCN.errors[kind] && en.errors[kind], kind);
  }
});

const provider = (id) => USAGE_PROVIDERS.find((known) => known.id === id);
const hoverProvider = (id) => HOVER_USAGE_PROVIDERS.find((known) => known.id === id);

test("providers: Claude Code on by default, the rest by their switches, each its own colour", () => {
  assert.deepEqual(shownUsageProviders({}).map(({ id }) => id), ["claudeCode"]);
  assert.deepEqual(shownHoverProviders({}), []);
  assert.equal(needsHoverOnlyGauge({}), false);
  assert.equal(needsHoverOnlyGauge({ claudeCode: false, dsh: true }), true);
  assert.equal(needsHoverOnlyGauge({ claudeCode: true, dsh: true }), false);
  assert.deepEqual(shownUsageProviders({ claudeCode: false, antigravity: true, kimi: true, codex: true }).map(({ id }) => id), ["codex", "antigravity", "kimi"]);
  const allColors = [...USAGE_PROVIDERS, ...HOVER_USAGE_PROVIDERS].map(({ color }) => color);
  assert.equal(new Set(allColors).size, USAGE_PROVIDERS.length + HOVER_USAGE_PROVIDERS.length);
  assert.ok(allColors.every((color) => ![USAGE_COLORS.warn, USAGE_COLORS.danger, USAGE_COLORS.stale].includes(color)));
  const glm = provider("glm");
  assert.deepEqual(usageRings(usage(), NOW, false, glm.color).map(({ color }) => color), [glm.color, glm.color]);
  assert.equal(usageRings(usage({ fiveHour: { name: "", used: 91, resetsAt: null } }), NOW, false, glm.color)[0].color, USAGE_COLORS.danger);
});

test("a plan without a weekly limit fills the inner ring with its month", () => {
  const kimi = usage({ sevenDay: null, models: [{ name: "month", used: 30, resetsAt: null }], source: "kimi", plan: null });
  assert.equal(usageRings(kimi, NOW)[1].value, 0.3);
  assert.deepEqual(texts(usageCardLines(kimi, NOW, zhCN, false, provider("kimi"))), ["Kimi", "5 小时 42% · 2 小时 13 分后重置", "本月 30%", "1 分钟前更新 · 来自 Kimi"]);
});

test("with a provider the card starts with its name and plan in its colour", () => {
  const claude = provider("claudeCode");
  const lines = usageCardLines(usage(), NOW, zhCN, false, claude);
  assert.deepEqual(lines[0], { text: "Claude Code · Max 20x", color: claude.color });
  const glm = usage({ source: "glm", plan: "GLM Coding Pro", models: [{ name: "mcpMonth", used: 5, resetsAt: null }] });
  assert.deepEqual(texts(usageCardLines(glm, NOW, en, false, provider("glm"))), [
    "GLM · GLM Coding Pro", "5h 42% · resets in 2h 13m", "7d 17% · resets in 3d 4h", "MCP month 5%", "updated 1 min ago · from Zhipu's open platform",
  ]);
  assert.deepEqual(texts(usageCardLines(null, NOW, zhCN, false, provider("codex"))), ["Codex", zhCN.noUsage.codex]);
  const noKey = usage({ source: "glm", fiveHour: null, sevenDay: null, updatedAt: null, plan: null, error: { kind: "noCredentials", message: "" } });
  assert.deepEqual(texts(usageCardLines(noKey, NOW, zhCN, false, provider("glm"))), ["GLM", zhCN.noUsage.glm, "还没有保存 API Key，请在设置 → AI Agent 的用量环里填写"]);
  for (const kind of Object.keys(zhCN.errors)) {
    assert.ok(zhCN.planErrors[kind] && en.planErrors[kind], kind);
    assert.ok(zhCN.antigravityErrors[kind] && en.antigravityErrors[kind], kind);
    assert.ok(zhCN.workbuddyErrors[kind] && en.workbuddyErrors[kind], kind);
    assert.ok(zhCN.dshErrors[kind] && en.dshErrors[kind], kind);
    assert.ok(zhCN.cursorErrors[kind] && en.cursorErrors[kind], kind);
  }
});

test("Antigravity renders Gemini and Claude/GPT windows, and reports endpointChanged instead of 0%", () => {
  const agy = provider("antigravity");
  const live = usage({
    source: "antigravity",
    plan: "Pro",
    fiveHour: { name: "", used: 7.4, resetsAt: NOW + 294 * MINUTE },
    sevenDay: { name: "", used: 1.8, resetsAt: NOW + 6 * 1440 * MINUTE },
    models: [
      { name: "3p5h", used: 12, resetsAt: NOW + 300 * MINUTE },
      { name: "3p7d", used: 4, resetsAt: null },
    ],
  });
  assert.deepEqual(texts(usageCardLines(live, NOW, zhCN, false, agy)), [
    "Antigravity · Pro",
    "5 小时 7% · 4 小时 54 分后重置",
    "7 天 2% · 6 天 0 小时后重置",
    "Claude / GPT 5 小时 12% · 5 小时 0 分后重置",
    "Claude / GPT 7 天 4%",
    "1 分钟前更新 · 来自 Antigravity 本地服务",
  ]);

  const broken = usage({
    source: "antigravity",
    fiveHour: null,
    sevenDay: null,
    updatedAt: null,
    plan: null,
    error: { kind: "endpointChanged", message: "" },
  });
  assert.deepEqual(usageRings(broken, NOW, false, agy.color), [
    { value: 0, color: USAGE_COLORS.stale },
    { value: 0, color: USAGE_COLORS.stale },
  ]);
  const brokenLines = texts(usageCardLines(broken, NOW, zhCN, false, agy));
  assert.equal(brokenLines[0], "Antigravity");
  assert.ok(brokenLines.some((line) => line.includes("接口失效")));
  assert.ok(brokenLines.every((line) => !line.includes("0%")));
});

test("Cursor fills the inner ring with its billing month, names Auto and API, and hides without numbers", () => {
  const cursor = provider("cursor");
  assert.equal(cursor.defaultOn, false);
  assert.ok(HIDDEN_WITHOUT_NUMBERS.has("cursor"));
  const live = usage({
    source: "cursor",
    plan: "Pro",
    fiveHour: null,
    sevenDay: null,
    models: [
      { name: "month", used: 60, resetsAt: NOW + (12 * 1440) * MINUTE },
      { name: "cursorAuto", used: 12.5, resetsAt: null },
      { name: "cursorApi", used: 47.5, resetsAt: null },
    ],
  });
  assert.equal(hasUsageNumbers(live), true);
  assert.deepEqual(usageRings(live, NOW, false, cursor.color), [
    { value: 0, color: USAGE_COLORS.stale },
    { value: 0.6, color: cursor.color },
  ]);
  assert.deepEqual(texts(usageCardLines(live, NOW, zhCN, false, cursor)), [
    "Cursor · Pro",
    "本月 60% · 12 天 0 小时后重置",
    "Auto 本月 13%",
    "指定模型本月 48%",
    "1 分钟前更新 · 来自 Cursor",
  ]);
  const signedOut = usage({ source: "cursor", fiveHour: null, sevenDay: null, updatedAt: null, plan: null, error: { kind: "loginRequired", message: "" } });
  assert.equal(hasUsageNumbers(signedOut), false);
  assert.equal(hasUsageNumbers(null), false);
  assert.deepEqual(texts(usageCardLines(signedOut, NOW, en, false, cursor)), ["Cursor", en.noUsage.cursor, en.cursorErrors.loginRequired]);
});

test("WorkBuddy and DSH format hover-only credits and wallet balances, and explain failures without showing 0", () => {
  const wb = hoverProvider("workbuddy");
  const dsh = hoverProvider("dsh");

  const wbLines = hoverProviderLines(
    {
      provider: "workbuddy",
      updatedAt: NOW - 2 * MINUTE,
      source: "workbuddy",
      available: null,
      credits: { today: 12.5, sevenDay: 42.75, total: 50, totalTokens: 14_000, sessions: 2 },
      wallets: [],
      error: null,
    },
    wb,
    NOW,
    zhCN,
  );
  assert.deepEqual(texts(wbLines), ["WorkBuddy", "今日已用 12.5 积分 · 7 天 42.75 积分（累计 50）", "2 分钟前更新 · 来自 WorkBuddy 会话记录"]);

  const wbNoLogs = hoverProviderLines(
    {
      provider: "workbuddy",
      updatedAt: null,
      source: "workbuddy",
      available: null,
      credits: null,
      wallets: [],
      error: { kind: "noSessions", message: "" },
    },
    wb,
    NOW,
    zhCN,
  );
  assert.deepEqual(texts(wbNoLogs), ["WorkBuddy", zhCN.workbuddyErrors.noSessions]);

  const dshOk = hoverProviderLines(
    {
      provider: "dsh",
      updatedAt: NOW - MINUTE,
      source: "dshApi",
      available: true,
      credits: null,
      wallets: [{ currency: "CNY", total: "63.88", toppedUp: "53.88", granted: "10.00" }],
      error: null,
    },
    dsh,
    NOW,
    zhCN,
  );
  assert.deepEqual(texts(dshOk), ["DeepSeek Harness", "余额 ¥63.88（充值 ¥53.88 · 赠送 ¥10.00）", "1 分钟前更新 · 来自 DeepSeek 开放平台"]);

  const dshCustom = hoverProviderLines(
    {
      provider: "dsh",
      updatedAt: null,
      source: null,
      available: null,
      credits: null,
      wallets: [],
      error: { kind: "customEndpoint", message: "" },
    },
    dsh,
    NOW,
    zhCN,
  );
  assert.deepEqual(texts(dshCustom), ["DeepSeek Harness", zhCN.dshErrors.customEndpoint]);
});

test("the usage rings' config falls back to its defaults and keeps the interval in range", async () => {
  const { storedValue, usageConfig } = await import("../../src/features/claude-usage/usageConfig.ts");
  assert.deepEqual(usageConfig({}), {
    providers: { claudeCode: true, codex: false, antigravity: false, glm: false, kimi: false, cursor: false, workbuddy: false, dsh: false },
    show: "used",
    askAnthropic: false,
    proxy: "",
    intervalMinutes: 5,
  });
  const set = usageConfig({ claudeCode: false, antigravity: true, dsh: true, kimi: true, show: "remaining", askAnthropic: true, proxy: "http://127.0.0.1:7890", intervalMinutes: 500 });
  assert.deepEqual(set, {
    providers: { claudeCode: false, codex: false, antigravity: true, glm: false, kimi: true, cursor: false, workbuddy: false, dsh: true },
    show: "remaining",
    askAnthropic: true,
    proxy: "http://127.0.0.1:7890",
    intervalMinutes: 120,
  });
  assert.equal(usageConfig({ show: "odd", intervalMinutes: "soon", proxy: 3 }).show, "used");
  assert.equal(usageConfig({ intervalMinutes: 1 }).intervalMinutes, 5);
  assert.equal(storedValue("claudeCode", true), null, "a default value is removed from plugins.yml");
  assert.equal(storedValue("antigravity", false), null);
  assert.equal(storedValue("dsh", false), null);
  assert.equal(storedValue("intervalMinutes", 30), 30);
});

test("agents/v1 usage reports turn back into the ring's usage", async () => {
  const { isServiceOff, usageFromReport } = await import("../../src/features/claude-usage/agentUsage.ts");
  const report = { updatedAt: NOW, fiveHour: { name: "", used: 10, resetsAt: null }, sevenDay: null, models: [], plan: "Pro", source: "api", error: "tokenExpired" };
  assert.deepEqual(usageFromReport(report), { ...report, source: "api", error: { kind: "tokenExpired", message: "" } });
  assert.deepEqual(usageFromReport({ ...report, source: "antigravity", error: "endpointChanged" }), { ...report, source: "antigravity", error: { kind: "endpointChanged", message: "" } });
  assert.deepEqual(usageFromReport({ ...report, source: "other", error: "unknown" }), { ...report, source: "hud", error: null });
  assert.equal(usageFromReport(null), null);
  assert.equal(isServiceOff(Object.assign(new Error("off"), { code: "not-ready" })), true);
  assert.equal(isServiceOff(new Error("failed")), false);
});
