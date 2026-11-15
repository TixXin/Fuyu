import { execFileSync } from "node:child_process";
import { hostname as osHostname } from "node:os";

export const MACHINE_KEY = "fuyu.machine";
export const MACHINE_ALIAS_KEY = "fuyu.machineAlias";

export function machineSlug(raw) {
  return String(raw ?? "").split(".")[0].toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "host";
}

function output(file, args, cwd) {
  try {
    return execFileSync(file, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true }).trim();
  } catch {
    return "";
  }
}

function scutilLocalHostName() {
  return output("/usr/sbin/scutil", ["--get", "LocalHostName"]);
}

function gitConfig(cwd) {
  return (args) => output("git", ["config", "--local", ...args], cwd);
}

export function thisMachine(options = {}) {
  const {
    cwd = process.cwd(),
    platform = process.platform,
    hostname = osHostname,
    localHostName = scutilLocalHostName,
    config = gitConfig(cwd),
  } = options;
  const pinned = config(["--get", MACHINE_KEY]);
  const host = machineSlug(pinned || (platform === "darwin" && localHostName()) || hostname());
  if (!pinned) config([MACHINE_KEY, host]);
  const aliases = config(["--get-all", MACHINE_ALIAS_KEY]).split("\n").map((line) => line.trim()).filter(Boolean).map(machineSlug);
  return { host, aliases: [...new Set(aliases)].filter((alias) => alias !== host) };
}

export function machineName(options) {
  return thisMachine(options).host;
}
