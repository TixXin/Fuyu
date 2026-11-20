import { screenshotActionsV1, type ScreenshotActionEntry } from "@fuyu/plugin-services";
import { windowServices } from "../plugin-kernel/services";
import { keepScreenshot } from "./api";
import { screenshotActions, type ScreenshotActionContext, type ScreenshotActionItem, type ScreenshotActionResult } from "./host/actions.mjs";

export type CardAction = ScreenshotActionItem & { where: "window" | "host" };

const host = windowServices.get(screenshotActionsV1);
const listeners = new Set<() => void>();
const NONE: readonly CardAction[] = [];
let hostList: readonly ScreenshotActionEntry[] = [];
let combined: readonly CardAction[] = NONE;
let combinedKey = "";
let started = false;

export function mergeActions(local: readonly ScreenshotActionItem[], remote: readonly ScreenshotActionEntry[]): CardAction[] {
  const ids = new Set(local.map((action) => action.id));
  const fromHost = remote.filter((action) => !ids.has(action.id)).map((action) => ({ ...action, keeps: action.keeps === true, where: "host" as const }));
  return [...local.map((action) => ({ ...action, where: "window" as const })), ...fromHost].sort((a, b) => a.order - b.order);
}

function recompute() {
  const next = mergeActions(screenshotActions.list(), hostList);
  const key = JSON.stringify(next);
  if (key === combinedKey) return;
  combinedKey = key;
  combined = next.length === 0 ? NONE : next;
  for (const listener of [...listeners]) listener();
}

function takeHost(list: unknown) {
  hostList = Array.isArray(list) ? (list as ScreenshotActionEntry[]) : [];
  recompute();
}

function start() {
  if (started) return;
  started = true;
  screenshotActions.subscribe(recompute);
  const load = () => {
    host.list().then((answer) => takeHost(answer?.actions), () => takeHost([]));
  };
  load();
  void host.on("changed", (event) => takeHost(event?.actions));
  windowServices.watch(load);
}

export function subscribeCardActions(listener: () => void) {
  start();
  listeners.add(listener);
  recompute();
  return () => {
    listeners.delete(listener);
  };
}

export function cardActions() {
  return combined;
}

export async function runCardAction(action: CardAction, context: ScreenshotActionContext): Promise<ScreenshotActionResult> {
  const path = action.keeps ? await keepScreenshot(context.path) : context.path;
  const ready = { ...context, path };
  if (action.where === "window") return screenshotActions.run(action.id, ready);
  const answer = await host.run({ id: action.id, context: ready });
  return { message: typeof answer?.message === "string" ? answer.message : null, dismiss: answer?.dismiss === true };
}
