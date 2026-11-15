import { getAgentRemoteHosts } from "../../../features/agent-status/api";
import {
  addCcConnectProject,
  cancelCcConnectFeishuSetup,
  CC_CONNECT_PLUGIN_ID,
  checkCcConnectBot,
  getCcConnectFeishuSetup,
  getCcConnectRemoteStatus,
  getCcConnectStatus,
  installCcConnect,
  programSetting,
  sendCcConnectMessage,
  type CcConnectBotCheck,
  type CcConnectFeishuSetup,
  type CcConnectNewProject,
  type CcConnectProject,
  type CcConnectSetupAgent,
  type CcConnectSetupPlatform,
} from "../../../features/cc-connect/api";
import { remotePath } from "../../../features/cc-connect/remotePaths";
import { listPlugins, setPluginEnabled, setPluginSetting } from "../../../features/plugins/api";
import { builtinPluginState } from "../../../features/plugins/builtinPlugin";
import { isMacOS } from "../../../lib/platform";

export type PushAgent = CcConnectSetupAgent;

export type PushBlock = "macLocal" | "remoteSoon";

export type PushTargetState = {
  installed: boolean;
  running: boolean;
  agents: readonly PushAgent[];
  projects: CcConnectProject[];
  taken: string[];
};

export type PushProjectSpec = Omit<CcConnectNewProject, "workDir">;

export type PushTarget = {
  id: string;
  label: string | null;
  slug: string;
  remote: boolean;
  blocked: PushBlock | null;
  read(): Promise<PushTargetState>;
  install(): Promise<void>;
  prepare(): Promise<void>;
  checkBot(platform: CcConnectSetupPlatform, token: string): Promise<CcConnectBotCheck>;
  addProject(project: PushProjectSpec): Promise<void>;
  feishuProgress(): Promise<CcConnectFeishuSetup>;
  cancelFeishu(): Promise<void>;
  send(project: string, sessionKey: string, text: string): Promise<void>;
};

export const LOCAL_TARGET_ID = "local";
const KNOWN_AGENTS: readonly PushAgent[] = ["claudecode", "codex"];

export function targetSlug(name: string) {
  const slug = name.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return (slug || "pc").slice(0, 40);
}

async function localPath() {
  return programSetting(builtinPluginState(await listPlugins(), CC_CONNECT_PLUGIN_ID).settings);
}

function blockedTarget(id: string, label: string | null, slug: string, remote: boolean, blocked: PushBlock, read: () => Promise<PushTargetState>): PushTarget {
  const no = () => Promise.reject(new Error(blocked));
  return { id, label, slug, remote, blocked, read, install: no, prepare: no, checkBot: no, addProject: no, feishuProgress: no, cancelFeishu: no, send: no };
}

export function localTarget(mac = isMacOS): PushTarget {
  if (mac) {
    return blockedTarget(LOCAL_TARGET_ID, null, "local", false, "macLocal", async () => ({ installed: false, running: false, agents: KNOWN_AGENTS, projects: [], taken: [] }));
  }
  return {
    id: LOCAL_TARGET_ID,
    label: null,
    slug: "local",
    remote: false,
    blocked: null,
    async read() {
      const status = await getCcConnectStatus(await localPath());
      return {
        installed: status.exe !== null,
        running: status.running,
        agents: KNOWN_AGENTS,
        projects: status.projects,
        taken: [...status.configProjects, ...status.projects.map((project) => project.name)],
      };
    },
    async install() {
      await installCcConnect();
    },
    async prepare() {
      await setPluginEnabled(CC_CONNECT_PLUGIN_ID, true);
      await setPluginSetting(CC_CONNECT_PLUGIN_ID, "run", true);
    },
    checkBot: (platform, token) => checkCcConnectBot(platform, token),
    async addProject(project) {
      const path = await localPath();
      const workDir = (await getCcConnectStatus(path)).defaultWorkDir ?? "";
      await addCcConnectProject(path, { ...project, workDir });
    },
    feishuProgress: () => getCcConnectFeishuSetup(),
    cancelFeishu: () => cancelCcConnectFeishuSetup(),
    async send(project, sessionKey, text) {
      await sendCcConnectMessage(await localPath(), project, sessionKey, text);
    },
  };
}

export function remoteTarget(host: string): PushTarget {
  return blockedTarget(`ssh:${host}`, host, targetSlug(host), true, "remoteSoon", async () => {
    const status = await getCcConnectRemoteStatus(host, remotePath(host));
    return { installed: status.exe !== null, running: status.running, agents: KNOWN_AGENTS, projects: status.projects, taken: status.projects.map((project) => project.name) };
  });
}

export async function listPushTargets(mac = isMacOS): Promise<PushTarget[]> {
  const hosts = await getAgentRemoteHosts().catch(() => null);
  return [localTarget(mac), ...(hosts ?? []).map((entry) => remoteTarget(entry.host))];
}
