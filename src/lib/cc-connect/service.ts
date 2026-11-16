import { defineService } from "@fuyu/plugin-base/services";

export type CcConnectChat = { key: string; platform: string; userName: string | null };

export type CcConnectProject = { name: string; agent: string | null; chats: CcConnectChat[] };

export type CcConnectTargets = { exe: string | null; running: boolean; projects: CcConnectProject[] };

export type CcConnectMessage = { host: string; project: string; key: string; text: string };

export const CC_CONNECT_LOCAL_HOST = "";

type Methods = {
  targets(params: { host: string }): CcConnectTargets;
  send(params: CcConnectMessage): { sent: boolean };
};

export const ccConnectV1 = defineService<Methods>("cc-connect/v1", {
  methods: { targets: { timeoutMs: 60_000 }, send: { timeoutMs: 60_000 } },
  events: {},
});

export function ccConnectOff(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "not-ready";
}

export function ccConnectReason(error: unknown): unknown {
  const { message, data } = (error ?? {}) as { message?: unknown; data?: { reason?: unknown; args?: unknown; detail?: unknown } };
  if (typeof data?.reason !== "string") return error;
  return { code: data.reason, message: typeof message === "string" ? message : data.reason, args: data.args, detail: data.detail };
}
