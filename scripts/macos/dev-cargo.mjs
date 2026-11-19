import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signDevBinary } from "./dev-signing.mjs";

export const BINARY = "fuyu";
const DEBUG_PROFILES = new Set(["dev", "debug"]);

function option(args, name) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name) return args[i + 1];
    if (args[i].startsWith(`${name}=`)) return args[i].slice(name.length + 1);
  }
  return undefined;
}

export function planInvocation(args, { env = process.env, cwd = process.cwd(), platform = process.platform } = {}) {
  const passthrough = { mode: "passthrough" };
  const [subcommand] = args;
  if (platform !== "darwin" || (subcommand !== "run" && subcommand !== "build")) return passthrough;
  const separator = args.indexOf("--");
  const cargoArgs = separator >= 0 ? args.slice(1, separator) : args.slice(1);
  if (cargoArgs.includes("--release") || cargoArgs.includes("-r")) return passthrough;
  const profile = option(cargoArgs, "--profile");
  if (profile !== undefined && !DEBUG_PROFILES.has(profile)) return passthrough;
  const bin = option(cargoArgs, "--bin");
  if (bin !== undefined && bin !== BINARY) return passthrough;
  if (cargoArgs.some((arg) => arg === "--example" || arg.startsWith("--example="))) return passthrough;
  const targetDir = path.resolve(cwd, option(cargoArgs, "--target-dir") ?? env.CARGO_TARGET_DIR ?? env.CARGO_BUILD_TARGET_DIR ?? "target");
  const triple = option(cargoArgs, "--target") ?? env.CARGO_BUILD_TARGET;
  const binary = path.join(targetDir, ...(triple ? [triple] : []), "debug", BINARY);
  return { mode: subcommand, buildArgs: ["build", ...cargoArgs], binary };
}

function cargo(args) {
  const result = spawnSync("cargo", args, { stdio: "inherit" });
  return result.status ?? 1;
}

function sign(binary) {
  try {
    const { signed, message } = signDevBinary(binary);
    if (signed) console.error(`[dev-signing] ${message}`);
  } catch (error) {
    console.error(`[dev-signing] kept the ad-hoc signature, so the keychain may ask again: ${error.message}`);
  }
}

export function main(argv) {
  const prepare = argv[0] === "--prepare";
  const args = prepare ? argv.slice(1) : argv;
  const plan = planInvocation(args);
  if (prepare) {
    if (plan.mode !== "run") return 0;
    const status = cargo(plan.buildArgs);
    if (status === 0) sign(plan.binary);
    return status;
  }
  const status = cargo(args);
  if (status === 0 && plan.mode === "build") sign(plan.binary);
  return status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
