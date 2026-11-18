import type { AgentApprovalRequest } from "../../../../src/features/agent-status/approvals/api";
import type { AgentSessionSummary } from "../../../../src/features/agent-status/api";
import { ISLAND_SETTINGS_KEY } from "../../../../src/lib/settings/installState";
import { GLASS_LOOK_VALUES, type GlassLookId } from "../../../../src/lib/theme/glassLooks";
import type { IslandFrame } from "../../app/boot";
import { island, sleep } from "../../stage/island";
import { sound } from "../../stage/sound";
import { stage } from "../../stage/stageState";
import type { Copy } from "./copy";
import { playingMedia } from "./music";
import { SETTINGS_FRAME } from "./overlay";
import { scene } from "./state";

const DISCORD_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#5865F2"/><path d="M14 16c3-2 6-3 10-3s7 1 10 3c2 4 3 9 3 14-2 2-5 4-8 4l-2-3c2 0 3-1 4-2-3 1-5 2-7 2s-4-1-7-2c1 1 2 2 4 2l-2 3c-3 0-6-2-8-4 0-5 1-10 3-14z" fill="#fff"/><circle cx="19.5" cy="25" r="2.6" fill="#5865F2"/><circle cx="28.5" cy="25" r="2.6" fill="#5865F2"/></svg>')}`;
const TELEGRAM_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#2AABEE"/><path d="M11 23.5l23-9c1.1-.4 2 .3 1.7 1.9l-3.9 18.4c-.3 1.3-1.1 1.6-2.2 1l-6-4.4-2.9 2.8c-.3.3-.6.6-1.2.6l.4-6.1 11.1-10c.5-.4-.1-.7-.7-.3l-13.7 8.6-5.9-1.8c-1.3-.4-1.3-1.3.3-1.9z" fill="#fff"/></svg>')}`;

export function frameWindow() {
  return document.querySelector<HTMLIFrameElement>("#island-frame")!.contentWindow as unknown as IslandFrame & typeof globalThis;
}

export function applySettings(patch: Record<string, unknown>) {
  const view = frameWindow();
  const current = JSON.parse(view.localStorage.getItem(ISLAND_SETTINGS_KEY) ?? "{}") as Record<string, unknown>;
  view.localStorage.setItem(ISLAND_SETTINGS_KEY, JSON.stringify({ ...current, ...patch }));
  view.dispatchEvent(new view.StorageEvent("storage", { key: ISLAND_SETTINGS_KEY }));
}

export function glass(look: GlassLookId) {
  applySettings({ appearanceMode: "liquidGlass", ...GLASS_LOOK_VALUES[look], glassBackdrop: "wallpaper" });
}

function settingsElement(selector: string, index: number) {
  const frame = document.querySelector<HTMLIFrameElement>("#settings-frame");
  const element = frame?.contentDocument?.querySelectorAll<HTMLElement>(selector)[index];
  if (!element) throw new Error(`settings element not found: ${selector}[${index}]`);
  return element;
}

export function settingsPoint(selector: string, index = 0) {
  const element = settingsElement(selector, index);
  element.scrollIntoView({ block: "center" });
  const box = element.getBoundingClientRect();
  const { left, top, scale } = SETTINGS_FRAME;
  return { x: left + (box.left + box.width / 2) * scale, y: top + (box.top + box.height / 2) * scale };
}

export async function settingsClick(selector: string, index = 0, ms = 600) {
  const point = settingsPoint(selector, index);
  scene.set((current) => ({ cursor: { ...current.cursor, ...point, ms, visible: true } }));
  await sleep(ms);
  scene.set((current) => ({ cursor: { ...current.cursor, pressed: true } }));
  sound("click");
  await sleep(90);
  settingsElement(selector, index).click();
  await sleep(110);
  scene.set((current) => ({ cursor: { ...current.cursor, pressed: false } }));
}

function pointer(element: HTMLElement, type: "pointerover" | "pointerout") {
  const view = frameWindow();
  const box = element.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, pointerId: 1, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, relatedTarget: type === "pointerout" ? view.document.body : null };
  element.dispatchEvent(new view.PointerEvent(type, init));
  if (type === "pointerover") element.dispatchEvent(new view.PointerEvent("pointermove", init));
}

export async function hover(selector: string, index = 0, ms = 600) {
  await island.pointAt(selector, index, ms);
  pointer(island.find(selector, index), "pointerover");
}

export function unhover(selector: string, index = 0) {
  if (island.has(selector)) pointer(island.find(selector, index), "pointerout");
}

export function islandHovered(inside: boolean) {
  return island.emit("island-hover-changed", inside);
}

export function nativeTip(selector: string, text: string | null) {
  const view = frameWindow();
  view.document.querySelector("#native-tip")?.remove();
  if (text === null) return;
  const box = island.find(selector).getBoundingClientRect();
  const tip = view.document.createElement("div");
  tip.id = "native-tip";
  tip.textContent = text;
  Object.assign(tip.style, {
    position: "fixed", zIndex: "9999", left: `${box.left + box.width / 2}px`, top: `${box.bottom + 10}px`, transform: "translateX(-50%)",
    padding: "4px 9px", borderRadius: "5px", font: "12px/1.4 'Segoe UI', 'Microsoft YaHei UI', sans-serif", color: "#1d2129",
    background: "#f9f9fb", border: "1px solid rgba(0,0,0,0.14)", boxShadow: "0 6px 18px rgba(0,0,0,0.3)", whiteSpace: "nowrap",
  });
  view.document.body.append(tip);
}

export function patchSession(id: string, patch: Partial<AgentSessionSummary>) {
  const world = island.world();
  world.sessions = world.sessions.map((session) => session.sessionId === id ? { ...session, ...patch, updatedAt: Date.now() } : session);
}

export async function questionArrives(copy: Copy) {
  patchSession("s1", { phase: "waiting", currentTool: { name: "AskUserQuestion", detail: copy.question.question } });
  const request: AgentApprovalRequest = {
    id: 7, kind: "question", agent: "claudeCode", sessionId: "s1", cwd: String.raw`D:\code\fuyu`, toolName: "AskUserQuestion",
    toolInput: { questions: [{ question: copy.question.question, header: copy.question.header, options: copy.question.options, multiSelect: false }] },
    permissionSuggestions: null, receivedAt: Date.now(),
  };
  island.world().approvals = [request];
  sound("approval");
  await island.emit("agent-approval-requested", request);
}

export async function messagesArrive(copy: Copy) {
  const world = island.world();
  const view = frameWindow();
  world.qq = { ...world.qq, revision: world.qq.revision + 1, items: [{ id: "q1", title: copy.qq.title, body: copy.qq.body, createdAt: Date.now() }] };
  await island.emit("qq-notifications-changed", { snapshot: world.qq, newestId: "q1", windowVisible: true });
  await sleep(1000);
  const message = { ...copy.wechat, unread: 2, at: Date.now() };
  world.wechat = { ...world.wechat, revision: world.wechat.revision + 1, pending: true, lastAttentionAt: Date.now(), message, items: [{ at: Date.now(), message, reason: null }] };
  await island.emit("wechat-reminder-changed", { snapshot: world.wechat, windowVisible: true });
  await sleep(1000);
  view.__notice({ pluginId: "discord", pluginName: { "zh-CN": "Discord", en: "Discord" }, ...copy.discord, durationMs: 7000, actions: [], iconUrl: DISCORD_ICON });
  await sleep(1000);
  view.__notice({ pluginId: "telegram", pluginName: { "zh-CN": "Telegram", en: "Telegram" }, ...copy.telegram, durationMs: 7000, actions: [], iconUrl: TELEGRAM_ICON });
}

export async function mailArrives(copy: Copy) {
  const world = island.world();
  world.mail = { ...world.mail, revision: world.mail.revision + 1, unreadCount: 1, items: [{ id: "m1", uid: 1, sender: copy.mail.sender, subject: copy.mail.subject, unread: true, receivedAt: Date.now() }] };
  await island.emit("qq-mail-changed", { snapshot: world.mail, newestId: "m1", windowVisible: true });
}

export async function pluginsShown(copy: Copy, squeue: boolean) {
  const world = island.world();
  const monitor = { pluginId: "dev.focusd.system-monitor", itemId: "cpu", priority: 4, text: copy.monitor.text, tooltip: copy.monitor.tooltip, tone: "neutral" as const, ring: 0.23 };
  const jobs = { pluginId: "io.github.shenglin1001.squeue", itemId: "jobs", priority: 5, text: copy.plugin.status, tooltip: copy.plugin.tooltip, tone: "accent" as const, pie: [{ value: 3, tone: "accent" as const }, { value: 2, tone: "warning" as const }, { value: 1, tone: "danger" as const }] };
  world.plugins = { ...world.plugins, status: squeue ? [jobs, monitor] : [monitor] };
  await island.emit("plugin-view-changed", { kind: "reset", pluginId: jobs.pluginId, status: "running" });
}

export async function stopMusic() {
  island.world().media = { ...island.world().media, playbackStatus: "paused", audioActive: false };
  await island.emit("media-session-changed", { kind: "track", at: Date.now(), sessionId: "demo" });
}

export async function startMusic(copy: Copy) {
  island.world().media = playingMedia(copy, 0);
  await island.emit("media-session-changed", { kind: "track", at: Date.now(), sessionId: "demo" });
}

export function shake(times: number[], from: number) {
  const screen = document.querySelector<HTMLElement>(".screen");
  if (!screen) return;
  times.forEach((at) => window.setTimeout(() => {
    screen.animate(
      [{ transform: "none" }, { transform: "translate(1.5px, -1px) scale(1.006)" }, { transform: "translate(-1px, 1px)" }, { transform: "none" }],
      { duration: 260, easing: "ease-out" },
    );
  }, at - from));
}

export function hideStageCursor() {
  stage.set((current) => ({ cursor: { ...current.cursor, visible: false } }));
}
