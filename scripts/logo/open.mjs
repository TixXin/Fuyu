import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const page = fileURLToPath(new URL("../../docs/investigations/jellyfish-set-preview.html", import.meta.url));

if (!existsSync(page)) {
  console.error(`找不到 ${page}`);
  process.exit(1);
}

const url = pathToFileURL(page).href;
const [command, args] =
  process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
  : process.platform === "darwin" ? ["open", [url]]
  : ["xdg-open", [url]];

const child = spawn(command, args, { stdio: "ignore", detached: true });
child.on("error", (error) => {
  console.error(`打不开浏览器：${error.message}`);
  console.log(url);
  process.exit(1);
});
child.unref();
console.log(`已在浏览器打开水母标志预览：${url}`);
