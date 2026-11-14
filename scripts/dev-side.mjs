import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sideLane } from "./stop-running-island.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
if (sideLane(env) === null) env.FOCUSD_DEV_LANE = "1";

console.log(`Starting the development island as com.tixxin.fuyu.lane-${env.FOCUSD_DEV_LANE}: its own data, next to the installed one.`);
const command = ["pnpm", "tauri", "dev", ...process.argv.slice(2)].join(" ");
const child = spawn(command, { cwd: root, env, stdio: "inherit", shell: true });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
