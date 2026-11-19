import type { IslandNotice } from "../../lib/island-notices/service";
import type { LocalApiResponse } from "./api";

export type LocalApiNoticeDeps = {
  remember(sender: string): void;
  muted(sender: string): boolean;
  show(notice: IslandNotice): Promise<{ shown: boolean }> | { shown: boolean };
  now(): number;
};

export async function showLocalApiNotice(params: unknown, deps: LocalApiNoticeDeps): Promise<LocalApiResponse> {
  const { source, name, title, body, durationMs } = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;
  if (typeof source !== "string" || source === "" || typeof title !== "string" || typeof body !== "string" || typeof durationMs !== "number") {
    return { ok: false, status: 400, error: "A message needs a source, a title, a body and a duration." };
  }
  const label = typeof name === "string" && name !== "" ? name : source;
  const receivedAt = deps.now();
  deps.remember(source);
  if (deps.muted(source)) return { ok: true, data: { shown: false, receivedAt } };
  const { shown } = await deps.show({ pluginId: source, pluginName: { "zh-CN": label, en: label }, title, body, durationMs, actions: [] });
  return { ok: true, data: { shown, receivedAt } };
}
