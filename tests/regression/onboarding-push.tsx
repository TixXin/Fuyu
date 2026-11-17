import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/onboarding/OnboardingWindow.css";
import { PushAct } from "../../src/windows/onboarding/push/PushAct";
import { PUSH_STEPS } from "../../src/windows/onboarding/push/plan";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { until } from "./pollUntil";

const query = new URLSearchParams(location.search);
const automated = query.has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });

const QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const commands: { command: string; args: Record<string, unknown> }[] = [];
const plugin = { id: "cc-connect", kind: "builtin", enabled: false, background: [], config: {} as Record<string, unknown> };
const tunnelPlugin = { id: "ssh-tunnel", kind: "builtin", enabled: false, background: [], config: {} as Record<string, unknown> };
const tunnel = { host: "devbox", enabled: false, remotePort: null as number | null, state: "off", error: null };
const remote = { exe: null as string | null, running: false, projects: [] as typeof local.projects };
const local = {
  exe: null as string | null,
  exeSource: null as string | null,
  exeError: null,
  running: false,
  runner: "off",
  runnerError: null,
  dataDir: "C:\\Users\\me\\.cc-connect",
  defaultWorkDir: "C:\\Users\\me\\Fuyu\\cc-connect\\work",
  config: false,
  configProjects: [] as string[],
  projects: [] as { name: string; agent: string | null; chats: { key: string; platform: string; userName: string | null }[] }[],
};
let feishuStarted = 0;
const feishuAt = (started: number) => Date.now() - started < 600
  ? { running: true, qr: QR, url: "https://open.feishu.cn/x", done: false, allowFrom: null, error: null }
  : { running: false, qr: null, url: null, done: true, allowFrom: "ou_1", error: null };
mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  commands.push({ command, args });
  switch (command) {
    case "get_builtin_plugins": return [plugin, tunnelPlugin];
    case "set_builtin_plugin_enabled": {
      const target = args.id === tunnelPlugin.id ? tunnelPlugin : plugin;
      target.enabled = Boolean(args.enabled);
      return [plugin, tunnelPlugin];
    }
    case "set_builtin_plugin_config":
      plugin.config = { ...plugin.config, [String(args.key)]: args.value };
      if (args.key === "run") local.running = true;
      return [plugin, tunnelPlugin];
    case "get_agent_remote_hosts": return [{ host: "devbox", fetchedAt: 1, error: null, fetching: false }];
    case "get_cc_connect_status": return local;
    case "get_cc_connect_remote_status": return remote;
    case "detect_cc_connect_agents": return [{ agent: "claudecode", label: "Claude Code", path: "/usr/bin/claude" }];
    case "install_cc_connect_remote":
      remote.exe = "/home/me/.local/bin/cc-connect";
      return { exe: remote.exe, installed: true, version: "cc-connect v1.5.0" };
    case "add_cc_connect_remote_project":
      remote.projects = [...remote.projects, { name: String(args.project), agent: String(args.agent), chats: [] }];
      return null;
    case "restart_cc_connect_remote": remote.running = true; return null;
    case "get_ssh_tunnels": return [tunnel];
    case "check_ssh_tunnel_port": return false;
    case "set_ssh_tunnel":
      Object.assign(tunnel, { enabled: Boolean(args.enabled), remotePort: args.remotePort ?? null, state: args.enabled ? "connected" : "off" });
      return [tunnel];
    case "install_cc_connect":
      local.exe = "C:\\Users\\me\\Fuyu\\cc-connect\\cc-connect.exe";
      local.exeSource = "downloaded";
      return local.exe;
    case "check_cc_connect_bot": return { name: "fuyu_bot", inviteUrl: null, senders: [{ id: "4242", name: "Me" }] };
    case "add_cc_connect_project":
      local.configProjects = [...local.configProjects, String(args.project)];
      local.projects = [...local.projects, { name: String(args.project), agent: String(args.agent), chats: [] }];
      return null;
    case "get_cc_connect_feishu_setup":
      feishuStarted ||= Date.now();
      return feishuAt(feishuStarted);
    case "send_cc_connect_message": return null;
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("onboarding");

localStorage.setItem(LOCALE_STORAGE_KEY, query.get("locale") === "en" ? "en" : "zh-CN");
document.body.style.background = "linear-gradient(135deg, #3a3f55, #6a5a7a 50%, #2b4a6a)";

let skipped = 0;
function Harness() {
  const [step, setStep] = useState(Number(query.get("step") ?? 0));
  return (
    <main className="onboarding stage--font-system">
      <div className="onboarding__card" style={{ left: 40, top: 40, width: 340, maxHeight: 820 }}>
        <section className="onboarding__body">
          <PushAct step={step} onSkip={() => { skipped += 1; }} />
        </section>
        <footer className="onboarding__footer">
          <div className="onboarding__nav">
            <button className="onboarding__button" type="button" data-nav="back" onClick={() => setStep(Math.max(0, step - 1))}>back</button>
            <button className="onboarding__button" type="button" data-nav="next" onClick={() => setStep(Math.min(PUSH_STEPS - 1, step + 1))}>next</button>
          </div>
        </footer>
      </div>
    </main>
  );
}

const root = createRoot(document.getElementById("root")!);
const mount = () => root.render(<StrictMode><I18nProvider><Harness /></I18nProvider></StrictMode>);
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("button")];
const button = (label: string) => buttons().find((found) => found.textContent?.trim() === label);
const press = async (target: HTMLButtonElement | undefined, label: string) => {
  if (!target) throw new Error(`Missing button ${label}`);
  await act(async () => { target.click(); });
  await wait(20);
};
const nav = (which: "next" | "back") => press(document.querySelector<HTMLButtonElement>(`[data-nav="${which}"]`) ?? undefined, which);
const type = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await wait(10);
};
const body = () => document.querySelector<HTMLElement>(".onboarding__body")!;
const fits = () => body().scrollWidth <= body().clientWidth;
const active = () => document.querySelector(".push-act__step--active")?.textContent;
const rowOf = (selector: string) => document.querySelector<HTMLElement>(selector);
const called = (command: string) => commands.filter((entry) => entry.command === command);

if (!automated) {
  mount();
} else {
  try {
    await act(async () => { mount(); });
    await until(() => Boolean(rowOf('[data-target="local"]') && rowOf('[data-target="ssh:devbox"]')));
    check(document.querySelector(".onboarding__title")?.textContent === "推送到手机" && active() === "安装", "The act opens on the install step");
    check(document.querySelectorAll(".push-act__step").length === 5, "The progress shows five steps");
    const localRow = rowOf('[data-target="local"]');
    const remoteRow = rowOf('[data-target="ssh:devbox"]');
    check(localRow?.textContent?.includes("本机") && localRow.textContent.includes("未安装"), "This computer is listed as not installed");
    check(remoteRow?.textContent?.includes("devbox") && remoteRow.textContent.includes("未安装") && remoteRow.querySelector("button"), "A remote computer is listed with its own install button");
    const tunnelSwitch = () => document.querySelector<HTMLInputElement>('[data-tunnel="devbox"] input[type="checkbox"]');
    check(tunnelSwitch() && !tunnelSwitch()!.checked && rowOf('[data-tunnel="devbox"]')?.textContent?.includes("自己能上网"), "The install step asks whether the remote computer needs the SSH proxy tunnel");
    await act(async () => { tunnelSwitch()!.click(); });
    await until(() => called("set_ssh_tunnel").length > 0 && Boolean(rowOf('[data-tunnel="devbox"]')?.textContent?.includes("37897")));
    const saved = called("set_ssh_tunnel")[0]?.args;
    check(tunnelPlugin.enabled && saved?.host === "devbox" && saved.enabled === true && saved.remotePort === 37897, "Turning it on starts the tunnel plugin and opens port 37897 for that computer");
    check(rowOf('[data-tunnel="devbox"]')?.textContent?.includes("37897"), "The row shows the tunnel's remote port");
    await press(localRow?.querySelector("button") ?? undefined, "安装");
    await until(() => Boolean(rowOf('[data-target="local"]')?.textContent?.includes("已安装")));
    check(called("install_cc_connect").length === 1 && rowOf('[data-target="local"]')?.textContent?.includes("已安装"), "Install downloads cc-connect and the row turns installed");
    check(fits(), "The install step fits a narrow card");

    await nav("next");
    check(active() === "建项目" && button("可以，列出来") && !document.querySelector(".push-act__input"), "Projects asks first before listing anything");
    await press(button("可以，列出来"), "agree");
    const names = () => [...document.querySelectorAll<HTMLInputElement>(".push-act__row--project .push-act__input")];
    check(names().map((input) => input.value).join(",") === "local-claudecode,local-codex", "One project per agent on the installed computer, named <computer>-<agent>");
    await type(names()[1], "local-claudecode");
    check(document.querySelector(".push-act__error")?.textContent === "和另一个项目重名", "Two projects with one name are flagged");
    await type(names()[1], "my-codex");
    check(!document.querySelector(".push-act__error"), "Renaming clears the warning");
    check(fits(), "The projects step fits a narrow card");

    await nav("next");
    check(active() === "选平台", "Step three picks the platform");
    const platforms = [...document.querySelectorAll<HTMLElement>(".push-act__platform")];
    check(platforms.length === 4 && platforms[0].classList.contains("push-act__platform--chosen") && platforms[0].textContent?.includes("推荐"), "Feishu is recommended and picked by default");
    const wechat = platforms[3].querySelector<HTMLButtonElement>(".push-act__platform-pick")!;
    check(wechat.disabled && platforms[3].textContent?.includes("不推荐"), "WeChat is marked not recommended and can't be picked");
    check(platforms.every((platform) => platform.querySelectorAll(".push-act__link").length === 2), "Every platform links to making a bot and to the official guide");
    check(fits(), "The platform step fits a narrow card");

    await nav("next");
    check(active() === "接机器人" && document.querySelectorAll(".push-act__row--connect").length === 2, "Step four has a row per project");
    const claude = () => rowOf('[data-project="local-claudecode"]')!;
    await press(claude().querySelector<HTMLButtonElement>(".onboarding__button--primary") ?? undefined, "scan");
    check(plugin.enabled && plugin.config.run === true, "Connecting the first bot turns cc-connect on and lets the island run it");
    const added = called("add_cc_connect_project")[0]?.args;
    check(added?.project === "local-claudecode" && added.platform === "feishu" && added.agent === "claudecode" && added.workDir === local.defaultWorkDir, "Scanning adds the project for Feishu");
    check(claude().querySelector("img") && rowOf('[data-project="my-codex"]')!.querySelector<HTMLButtonElement>(".onboarding__button--primary")?.disabled,
      "The QR code shows in the row, and the other row waits for it");
    await until(() => Boolean(claude().textContent?.includes("已接上")));
    check(claude().textContent?.includes("已接上"), "The row is connected once the scan is done");

    await nav("back");
    await press(document.querySelectorAll<HTMLElement>(".push-act__platform-pick")[1] as HTMLButtonElement, "Telegram");
    await nav("next");
    const codex = () => rowOf('[data-project="my-codex"]')!;
    check(claude().textContent?.includes("已接上") && codex().querySelector('input[type="password"]'), "Telegram rows ask for a token, and the connected row stays connected");
    await type(codex().querySelector<HTMLInputElement>('input[type="password"]')!, "123:abc");
    await press(button("识别"), "find");
    check(codex().querySelector<HTMLInputElement>('input:not([type="password"])')?.value === "4242", "The only sender's ID is filled in");
    await press(codex().querySelector<HTMLButtonElement>(".onboarding__button--primary") ?? undefined, "connect");
    const second = called("add_cc_connect_project")[1]?.args;
    check(second?.project === "my-codex" && second.platform === "telegram" && second.token === "123:abc" && second.allowFrom === "4242", "Connect writes the Telegram project");
    check(codex().textContent?.includes("已接上") && fits(), "Both rows are connected and the step fits a narrow card");

    await nav("next");
    check(active() === "测试" && document.querySelectorAll(".push-act__list > li").length === 2, "The test step lists the connected projects");
    check(!button("发测试消息") && claude().textContent?.includes("还没收到"), "Without a message from the phone there is nothing to send to");
    local.projects = local.projects.map((project) => project.name === "my-codex" ? { ...project, chats: [{ key: "telegram:4242:4242", platform: "telegram", userName: "Me" }] } : project);
    await until(() => Boolean(codex().textContent?.includes("已收到手机发来的消息")), 6000);
    check(codex().textContent?.includes("已收到手机发来的消息"), "A message from the phone ticks the row");
    await press(button("发测试消息"), "send");
    const sent = called("send_cc_connect_message")[0]?.args;
    check(sent?.project === "my-codex" && sent.sessionKey === "telegram:4242:4242" && codex().textContent?.includes("已发出"), "Send a test goes to that chat");
    check(!button("先不设置推送") && skipped === 0, "The last step has no skip link");
    await nav("back");
    await press(button("先不设置推送"), "skip");
    check(skipped === 1, "Skip leaves the act");
    await nav("next");
    check(fits(), "The test step fits a narrow card");

    for (let at = 0; at < PUSH_STEPS - 1; at += 1) await nav("back");
    await press(rowOf('[data-target="ssh:devbox"]')?.querySelector("button") ?? undefined, "install remote");
    await until(() => Boolean(rowOf('[data-target="ssh:devbox"]')?.textContent?.includes("已安装")));
    check(called("install_cc_connect_remote")[0]?.args.host === "devbox" && rowOf('[data-target="ssh:devbox"]')?.textContent?.includes("已安装"), "Install puts cc-connect on the remote computer");
    await nav("next");
    check(names().map((input) => input.value).join(",") === "local-claudecode,my-codex,devbox-claudecode", "The remote computer gets a project only for the agent found there");
    await nav("next");
    await nav("next");
    const devbox = () => rowOf('[data-project="devbox-claudecode"]')!;
    await type(devbox().querySelector<HTMLInputElement>('input[type="password"]')!, "456:def");
    await type(devbox().querySelector<HTMLInputElement>('input:not([type="password"])')!, "4242");
    await press(devbox().querySelector<HTMLButtonElement>(".onboarding__button--primary") ?? undefined, "connect remote");
    await until(() => Boolean(devbox().textContent?.includes("已接上")));
    const remoteAdded = called("add_cc_connect_remote_project")[0]?.args;
    check(remoteAdded?.host === "devbox" && remoteAdded.platform === "telegram" && remoteAdded.workDir === "~" && remoteAdded.token === "456:def", "A remote Telegram project goes in the remote home folder");
    check(called("restart_cc_connect_remote")[0]?.args.host === "devbox" && devbox().textContent?.includes("已接上"), "cc-connect there restarts and the row is connected");
    document.documentElement.dataset.testResult = "passed";
  } catch (error) {
    document.documentElement.dataset.testResult = "failed";
    messages.push(`FAIL ${String(error)}`);
    console.error(error);
  } finally {
    document.getElementById("results")!.textContent = messages.join("\n");
  }
}
