import type { IslandControl } from "@fuyu/plugin-base/client";
import type { IslandPageRefusal } from "./islandPageRequest.ts";

type HostCall = (method: string, params?: unknown) => Promise<unknown>;

export type IslandRequest =
  | { id: number; action: "open" | "collapse"; plugin: string; page?: string }
  | { id: number; action: "notify"; plugin: string; notice: object };

export type IslandNoticeHandler = (notice: unknown) => boolean;

const REFUSALS: Readonly<Record<IslandPageRefusal, (plugin: string, page?: string) => string>> = {
  "no-page": (plugin) => `${plugin} has no island page right now`,
  "not-owner": (plugin, page) => `${page} is not one of ${plugin}'s island pages`,
  "not-found": (plugin, page) => `${plugin} has no island page called ${page}`,
};

let local: IslandControl | null = null;
let noticeHandler: IslandNoticeHandler | null = null;
let islandHost: HostCall | null = null;

export function islandFailure(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

export function islandRefusal(refusal: IslandPageRefusal, plugin: string, page?: string): Error & { code: string } {
  return islandFailure(refusal, REFUSALS[refusal](plugin, page));
}

export function setLocalIslandControl(next: IslandControl): () => void {
  local = next;
  return () => {
    if (local === next) local = null;
  };
}

export function setLocalIslandNotices(next: IslandNoticeHandler): () => void {
  noticeHandler = next;
  return () => {
    if (noticeHandler === next) noticeHandler = null;
  };
}

export function attachIslandHost(call: HostCall): () => void {
  islandHost = call;
  return () => {
    if (islandHost === call) islandHost = null;
  };
}

export function sendIslandNoticeAction(pluginId: string, action: string): Promise<unknown> {
  if (!islandHost) return Promise.reject(islandFailure("not-ready", "the plugin host is not connected"));
  return islandHost("island.noticeAction", { pluginId, action });
}

const localControl: IslandControl = {
  open: (plugin, page) => (local ? local.open(plugin, page) : Promise.reject(islandFailure("not-ready", "the island is not ready yet"))),
  collapse: (plugin) => (local ? local.collapse(plugin) : Promise.reject(islandFailure("not-ready", "the island is not ready yet"))),
};

export function islandControlFor(window: string, call: HostCall): IslandControl {
  if (window === "island") return localControl;
  return {
    open: async (plugin, page) => {
      await call("island.open", page ? { plugin, page } : { plugin });
    },
    collapse: async (plugin) => (await call("island.collapse", { plugin })) === true,
  };
}

export function readIslandRequest(data: unknown): IslandRequest | null {
  if (!data || typeof data !== "object") return null;
  const { id, action, plugin, page, notice } = data as Record<string, unknown>;
  if (typeof id !== "number" || typeof plugin !== "string" || plugin === "") return null;
  if (action === "notify") return notice && typeof notice === "object" ? { id, action, plugin, notice } : null;
  if (action !== "open" && action !== "collapse") return null;
  return typeof page === "string" && page !== "" ? { id, action, plugin, page } : { id, action, plugin };
}

async function runIslandRequest(request: IslandRequest): Promise<unknown> {
  if (request.action === "notify") {
    if (!noticeHandler) throw islandFailure("not-ready", "the island cannot show notices yet");
    return noticeHandler(request.notice) === true;
  }
  if (request.action === "open") return (await localControl.open(request.plugin, request.page), null);
  return localControl.collapse(request.plugin);
}

export async function answerIslandRequest(data: unknown, call: HostCall): Promise<void> {
  const request = readIslandRequest(data);
  if (!request) return;
  try {
    const value = await runIslandRequest(request);
    await call("island.result", { id: request.id, value });
  } catch (error) {
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? (error as { code: string }).code : "failed";
    await call("island.result", { id: request.id, error: { code, message: String((error as Error | null)?.message ?? error) } });
  }
}
