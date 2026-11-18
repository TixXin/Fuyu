import { getAgentRemoteHosts } from "../../../features/agent-status/api";
import {
  addCcConnectProject,
  addCcConnectRemoteProject,
  cancelCcConnectFeishuSetup,
  cancelCcConnectRemoteFeishuSetup,
  checkCcConnectBot,
  detectCcConnectAgents,
  getCcConnectFeishuSetup,
  getCcConnectRemoteFeishuSetup,
  getCcConnectRemoteStatus,
  getCcConnectStatus,
  installCcConnect,
  installCcConnectRemote,
  programSetting,
  restartCcConnectRemote,
  sendCcConnectMessage,
  sendCcConnectRemoteMessage,
  startCcConnectRemoteFeishuSetup,
  type CcConnectBotCheck,
  type CcConnectFeishuSetup,
  type CcConnectNewProject,
  type CcConnectProject,
  type CcConnectSetupAgent,
  type CcConnectSetupPlatform,
} from "../../../features/cc-connect/api";
import { remotePath } from "../../../features/cc-connect/remotePaths";
import { OWNER as CC_CONNECT_PLUGIN } from "../../../features/cc-connect/plugin/owner";
import { getBuiltinPlugins } from "../../../features/plugin-kernel/api";
import { setBuiltinConfig, switchBuiltinPlugin } from "../../../features/plugin-kernel/builtinSwitches";

export type PushAgent = CcConnectSetupAgent;

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
  const plugins = await getBuiltinPlugins();
  return programSetting(plugins.find((plugin) => plugin.id === CC_CONNECT_PLUGIN)?.config ?? {});
}

export function localTarget(): PushTarget {
  return {
    id: LOCAL_TARGET_ID,
    label: null,
    slug: "local",
    remote: false,
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
      await switchBuiltinPlugin(CC_CONNECT_PLUGIN, true);
      await setBuiltinConfig(CC_CONNECT_PLUGIN, "run", true);
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

const REMOTE_HOME = "~";

export function remoteTarget(host: string): PushTarget {
  let agents: Promise<readonly PushAgent[]> | null = null;
  const detect = () => {
    agents ??= detectCcConnectAgents(host).then(
      (found) => found.map((entry) => entry.agent),
      (reason: unknown) => {
        agents = null;
        throw reason;
      },
    );
    return agents;
  };
  return {
    id: `ssh:${host}`,
    label: host,
    slug: targetSlug(host),
    remote: true,
    async read() {
      const [status, found] = await Promise.all([getCcConnectRemoteStatus(host, remotePath(host)), detect()]);
      return { installed: status.exe !== null, running: status.running, agents: found, projects: status.projects, taken: status.projects.map((project) => project.name) };
    },
    async install() {
      await installCcConnectRemote(host, remotePath(host));
    },
    prepare: () => Promise.resolve(),
    checkBot: (platform, token) => checkCcConnectBot(platform, token),
    async addProject({ platform, ...project }) {
      if (platform === "feishu") {
        await startCcConnectRemoteFeishuSetup(host, remotePath(host), { project: project.project, agent: project.agent, workDir: REMOTE_HOME });
        return;
      }
      await addCcConnectRemoteProject(host, { ...project, platform, workDir: REMOTE_HOME });
      await restartCcConnectRemote(host, remotePath(host));
    },
    feishuProgress: () => getCcConnectRemoteFeishuSetup(),
    cancelFeishu: () => cancelCcConnectRemoteFeishuSetup(),
    send: (project, sessionKey, text) => sendCcConnectRemoteMessage(host, remotePath(host), project, sessionKey, text),
  };
}

export async function listPushTargets(): Promise<PushTarget[]> {
  const hosts = await getAgentRemoteHosts().catch(() => null);
  return [localTarget(), ...(hosts ?? []).map((entry) => remoteTarget(entry.host))];
}
