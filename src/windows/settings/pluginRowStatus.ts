import type { MarketCatalogPlugin, MarketVersionCandidate } from "@fuyu/plugin-services";
import type { BuiltinPluginName } from "../../i18n/sections/settings/pluginsV3";
import { BUILTIN_PROVIDES, stateOf } from "./pluginServiceStatus.ts";
import type { PluginStatusV3 } from "./usePluginHostStatus";

export type RowDot = "ok" | "off" | "bad" | "wait";

export type RowLabel = "off" | "failed" | "paused" | "waiting" | "safe" | "unknown" | "bisect" | "starting" | "stopped" | "waitingRuntime";

export type RowNote =
  | { kind: "failed"; text: string }
  | { kind: "paused"; errors: number; seconds: number }
  | { kind: "waiting"; service: string; provider: BuiltinPluginName | null; providerOff: boolean }
  | { kind: "unreachable"; windows: string[] }
  | { kind: "revoked" }
  | { kind: "trust"; version: string }
  | { kind: "update"; version: string; fresh: boolean };

export interface RowStatus {
  dot: RowDot;
  label: RowLabel | null;
  note: RowNote | null;
  attention: boolean;
}

export interface RowContext {
  live: boolean;
  runtime: "ready" | "downloading" | "failed";
  builtins?: readonly { id: string; enabled: boolean }[] | null;
}

const ATTENTION_NOTES = new Set<RowNote["kind"]>(["failed", "paused", "waiting", "unreachable", "revoked", "trust"]);

export function marketActionCandidate(plugin: MarketCatalogPlugin): { candidate: MarketVersionCandidate; isUpdate: boolean } | null {
  if (!plugin.installedVersion) {
    const candidate = plugin.install ?? plugin.manual;
    return candidate ? { candidate, isUpdate: false } : null;
  }
  const candidate = plugin.autoUpdate ?? plugin.manual;
  return candidate ? { candidate, isUpdate: true } : null;
}

export function firstLine(text: string): string {
  return text.split(/\r?\n/).find((line) => line.trim() !== "")?.trim() ?? text.trim();
}

function waitingNote(plugin: PluginStatusV3, context: RowContext): RowNote | null {
  const service = plugin.waitingFor?.[0];
  if (!service) return null;
  const provider = (Object.entries(BUILTIN_PROVIDES).find(([, services]) => services?.includes(service))?.[0] ?? null) as BuiltinPluginName | null;
  const providerOff = provider !== null && context.builtins?.find((item) => item.id === provider)?.enabled === false;
  return { kind: "waiting", service, provider, providerOff };
}

function marketNote(market: MarketCatalogPlugin | undefined): RowNote | null {
  if (!market?.installedVersion) return null;
  if (market.revoked) return { kind: "revoked" };
  const action = marketActionCandidate(market);
  if (!action?.isUpdate || action.candidate.version === market.installedVersion) return null;
  const { candidate } = action;
  if (candidate.trustChange || candidate.confirmation.trustChange) return { kind: "trust", version: candidate.version };
  return { kind: "update", version: candidate.version, fresh: Boolean(candidate.fresh) };
}

function hostPart(plugin: PluginStatusV3, context: RowContext): Pick<RowStatus, "dot" | "label" | "note"> {
  const state = stateOf(plugin);
  if (state === "disabled") return { dot: "off", label: "off", note: null };
  if (!context.live) return { dot: "off", label: "unknown", note: null };
  if (context.runtime !== "ready" && state !== "running") return { dot: "wait", label: "waitingRuntime", note: null };
  switch (state) {
    case "failed":
      return { dot: "bad", label: "failed", note: { kind: "failed", text: firstLine(plugin.lastError?.text ?? plugin.error ?? plugin.reason ?? "") } };
    case "auto-disabled": {
      const blocked = plugin.blocked?.by === "errors" ? plugin.blocked : null;
      return { dot: "bad", label: "paused", note: { kind: "paused", errors: blocked?.errors ?? 0, seconds: Math.round((blocked?.windowMs ?? 0) / 1000) } };
    }
    case "safe-mode":
      return { dot: "off", label: "safe", note: null };
    case "bisect":
      return { dot: "off", label: "bisect", note: null };
    case "waiting":
      return { dot: "wait", label: "waiting", note: waitingNote(plugin, context) };
    case "loading":
      return { dot: "wait", label: "starting", note: null };
    case "stopped":
    case "unloading":
      return { dot: "off", label: "stopped", note: null };
    default:
      return plugin.unreachableClients?.length ? { dot: "bad", label: null, note: { kind: "unreachable", windows: plugin.unreachableClients } } : { dot: "ok", label: null, note: null };
  }
}

export function pluginRowStatus(plugin: PluginStatusV3, market: MarketCatalogPlugin | undefined, context: RowContext): RowStatus {
  const host = hostPart(plugin, context);
  const note = host.note ?? marketNote(market);
  const attention = host.dot === "bad" || host.label === "waiting" || (note !== null && ATTENTION_NOTES.has(note.kind));
  return { ...host, note, attention };
}
