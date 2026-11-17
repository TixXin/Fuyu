import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/LayoutEditor.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import type { SshTunnelHost, SshTunnelProxy } from "../../src/features/ssh-tunnel/api";
import { SshTunnelSettings } from "../../src/features/ssh-tunnel/SshTunnelSettings";

const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const off = (host: string, remotePort: number | null = null): SshTunnelHost => ({ host, enabled: false, remotePort, state: "off", error: null });
let hosts: SshTunnelHost[] = [
  { host: "zcm6", enabled: true, remotePort: 10089, state: "connected", error: null },
  off("a6", 20089),
  off("lab"),
  { host: "nas", enabled: true, remotePort: 30089, state: "error", error: "ssh exited with 255: Permission denied (publickey)." },
  { host: "gpu", enabled: true, remotePort: 37897, state: "portInUse", error: null },
  { host: "old", enabled: true, remotePort: 40089, state: "off", error: null },
];
const takenPorts = new Set([10089]);
const uncheckablePort = 40404;
let proxy: SshTunnelProxy | null = { port: 7897, found: "clashVerge", listening: true };
const builtin = { id: "ssh-tunnel", kind: "builtin", enabled: true, background: [{ name: "tunnels", registered: true, running: true }], config: {} as Record<string, unknown> };
const calls: { command: string; args: Record<string, unknown> }[] = [];
mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  calls.push({ command, args });
  switch (command) {
    case "get_builtin_plugins": return [builtin];
    case "set_builtin_plugin_config": {
      const key = String(args.key);
      if (args.value === null || args.value === undefined) delete builtin.config[key];
      else builtin.config = { ...builtin.config, [key]: args.value };
      return [builtin];
    }
    case "get_ssh_tunnels": return hosts;
    case "get_ssh_tunnel_proxy": return proxy;
    case "check_ssh_tunnel_port":
      if (args.remotePort === uncheckablePort) throw "Neither ss nor netstat runs on the server";
      return takenPorts.has(args.remotePort as number);
    case "set_ssh_tunnel": {
      const { host, enabled, remotePort } = args as { host: string; enabled: boolean; remotePort: number | null };
      hosts = hosts.map((entry) => entry.host === host ? { ...entry, enabled, remotePort, state: enabled ? "connecting" : "off" } : entry);
      return hosts;
    }
    default: throw new Error(`Unexpected command ${command}`);
  }
}, { shouldMockEvents: true });

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const page = document.getElementById("page")!;
const root = createRoot(page);
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
const row = (host: string) => [...document.querySelectorAll<HTMLElement>(".ssh-tunnel__host")].find((found) => found.querySelector("label")?.textContent === host)!;
const state = (host: string) => row(host).querySelector(".ssh-tunnel__state")?.textContent ?? "";
const flip = async (host: string) => { await act(async () => { row(host).querySelector<HTMLInputElement>("[role='switch']")!.click(); }); await settle(); };
const typePort = async (host: string, value: string) => {
  const input = row(host).querySelector<HTMLInputElement>(".ssh-tunnel__port")!;
  await act(async () => { input.value = value; input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
  await settle();
};
const dialog = () => document.querySelector<HTMLElement>("[role='alertdialog']");
const answer = async (text: string) => {
  await act(async () => { [...dialog()!.querySelectorAll("button")].find((button) => button.textContent === text)!.click(); });
  await settle();
};
const lastSet = () => calls.filter((call) => call.command === "set_ssh_tunnel").slice(-1)[0]?.args;
const lastConfig = () => calls.filter((call) => call.command === "set_builtin_plugin_config").slice(-1)[0]?.args;
const shown = () => page.textContent ?? "";
const proxyStatus = () => document.querySelector<HTMLElement>(".ssh-tunnel__proxy-status");
const pickLocalProxy = async (value: string) => {
  await act(async () => { page.querySelector<HTMLButtonElement>("button[aria-label='本地代理']")!.click(); });
  await act(async () => { page.querySelector<HTMLElement>(`.select-control__option[data-value='${value}']`)!.click(); });
  await settle();
};

try {
  await act(async () => {
    root.render(
      <StrictMode><I18nProvider>
        <SshTunnelSettings />
      </I18nProvider></StrictMode>,
    );
  });
  await settle();

  check(proxyStatus()?.querySelector("code")?.textContent === "127.0.0.1:7897"
    && proxyStatus()?.textContent?.includes("端口来自 Clash Verge 的设置，代理正在监听。"),
  "The active proxy row shows the local proxy found and that it listens");
  proxy = { port: 10808, found: "v2rayNDefault", listening: false };
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3_200)); });
  check(proxyStatus()?.querySelector("code")?.textContent === "127.0.0.1:10808"
    && proxyStatus()?.querySelector(".ssh-tunnel__error")?.textContent === "v2rayN 的默认端口，但现在没有程序在监听这个端口：请打开代理软件。",
  "A proxy nothing listens on is read again and flagged");
  proxy = { port: 7897, found: "clashVerge", listening: true };
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3_200)); });

  await pickLocalProxy("clash-verge");
  check(lastConfig()?.id === "ssh-tunnel" && lastConfig()?.key === "localProxy" && lastConfig()?.value === "clash-verge"
    && shown().includes("本地代理") && !shown().includes("本地端口"),
  "The local port field stays hidden until Custom port is picked");
  await pickLocalProxy("custom");
  check(lastConfig()?.key === "localProxy" && lastConfig()?.value === "custom" && shown().includes("本地端口"),
    "Picking Custom port shows the local port field");

  check(state("zcm6") === "已连接" && row("zcm6").querySelector("code")?.textContent
    === "export http_proxy=http://127.0.0.1:10089 https_proxy=http://127.0.0.1:10089 HTTPS_PROXY=http://127.0.0.1:10089",
  "A connected host says so and offers the export line for the server");
  check(state("gpu") === "端口被占用，等待中", "A host whose port the server refused waits for it");
  check(state("nas").includes("连接失败") && state("nas").includes("Permission denied"), "A failed host shows why");
  check(state("old") === "插件开启后连接", "A host switched on while the plugin is off says it waits for the plugin");
  check(state("lab") === "先填服务器端口" && !row("lab").querySelector("code"), "A host without a port asks for one and has no export line");

  await flip("a6");
  check(lastSet()?.host === "a6" && lastSet()?.enabled === true && lastSet()?.remotePort === 20089 && !dialog(),
    "Switching on a host whose port is free there sets the tunnel up without asking");

  const setsBefore = calls.filter((call) => call.command === "set_ssh_tunnel").length;
  await typePort("lab", "80");
  check(state("lab") === "端口要是 1024–65535 的整数" && calls.filter((call) => call.command === "set_ssh_tunnel").length === setsBefore,
    "A server port below 1024 is refused and not saved");

  await typePort("lab", "10089");
  check(lastSet()?.host === "lab" && lastSet()?.enabled === false && lastSet()?.remotePort === 10089, "A port typed on a host that is off is saved, still off");
  await flip("lab");
  check(dialog()?.textContent?.includes("lab 上的端口 10089 已被占用（可能是另一个隧道），仍要搭建隧道吗？"), "Switching on a host whose port is taken there asks first");
  await answer("否");
  check(!dialog() && lastSet()?.enabled === false && !row("lab").querySelector<HTMLInputElement>("[role='switch']")!.checked, "No leaves the host off");
  await flip("lab");
  await answer("是");
  check(!dialog() && lastSet()?.host === "lab" && lastSet()?.enabled === true && lastSet()?.remotePort === 10089, "Yes sets the tunnel up anyway");

  await typePort("zcm6", "10089");
  check(lastSet()?.host === "lab", "Leaving a host's port as it was saves nothing");

  await typePort("a6", String(uncheckablePort));
  check(dialog()?.textContent?.includes("没能检查 a6 上的端口 40404 是否被占用（Neither ss nor netstat runs on the server），仍要搭建隧道吗？"),
    "A port the server could not check asks too, and says why");
  await answer("否");
  check(!dialog() && lastSet()?.host === "a6" && lastSet()?.enabled === false && lastSet()?.remotePort === uncheckablePort, "No there leaves the host off");

  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  document.documentElement.dataset.testResult = "failed";
  messages.push(`FAIL ${String(error)}`);
  console.error(error);
} finally {
  document.getElementById("results")!.textContent = messages.join("\n");
}
