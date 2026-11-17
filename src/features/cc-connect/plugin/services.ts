import { windowServices } from "../../plugin-kernel/services";
import { getBuiltinPlugins } from "../../plugin-kernel/api";
import { builtinPlugins } from "../../plugin-kernel/builtinSwitches";
import { isNativeError } from "../../../i18n/nativeError";
import { ccConnectV1, type CcConnectTargets } from "../../../lib/cc-connect/service";
import { getCcConnectRemoteStatus, getCcConnectStatus, programSetting, sendCcConnectMessage, sendCcConnectRemoteMessage } from "../api";
import { remotePath } from "../remotePaths";
import { OWNER } from "./owner.ts";

function failed(error: unknown): never {
  const message = error instanceof Error ? error.message : isNativeError(error) ? error.message : String(error);
  const data = isNativeError(error) ? { reason: error.code, args: error.args, detail: error.detail } : undefined;
  throw Object.assign(new Error(message), { code: "failed", data });
}

function badParams(message: string): never {
  throw Object.assign(new Error(`cc-connect/v1 ${message}`), { code: "bad-params" });
}

function hostOf(params: unknown): string {
  const host = (params as { host?: unknown } | null)?.host;
  if (typeof host !== "string") badParams("needs { host }, with \"\" for this computer");
  return host;
}

async function programPath(): Promise<string> {
  const plugins = builtinPlugins() ?? (await getBuiltinPlugins().catch(() => []));
  return programSetting(plugins.find((plugin) => plugin.id === OWNER)?.config ?? {});
}

async function targets(host: string): Promise<CcConnectTargets> {
  if (host) return getCcConnectRemoteStatus(host, remotePath(host)).catch(failed);
  const status = await getCcConnectStatus(await programPath()).catch(failed);
  return { exe: status.exe, running: status.running, projects: status.projects };
}

windowServices.provide(ccConnectV1, {
  targets: (params) => targets(hostOf(params)),
  send: async (params) => {
    const host = hostOf(params);
    const { project, key, text } = params;
    if (typeof project !== "string" || typeof key !== "string" || typeof text !== "string") badParams("send needs { host, project, key, text }");
    if (host) await sendCcConnectRemoteMessage(host, remotePath(host), project, key, text).catch(failed);
    else await sendCcConnectMessage(await programPath(), project, key, text).catch(failed);
    return { sent: true };
  },
}, { owner: OWNER });
