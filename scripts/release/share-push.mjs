import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const BOT_INBOX_ENV = "FUYU_BOT_INBOX";

export function shareManifest(version, imageName) {
  return {
    version,
    channel: version.includes("-") ? "beta" : "stable",
    image: imageName,
    url: `https://github.com/TixXin/fuyu/releases/tag/v${version}`,
  };
}

export function pushToBot(pngPath, version, inbox = process.env[BOT_INBOX_ENV]) {
  if (!inbox) throw new Error(`Set ${BOT_INBOX_ENV} to the bot inbox (an scp destination such as host:/path/inbox/).`);
  const manifestPath = join(dirname(pngPath), `fuyu-v${version}.json`);
  writeFileSync(manifestPath, `${JSON.stringify(shareManifest(version, basename(pngPath)), null, 2)}\n`);
  const target = inbox.endsWith("/") ? inbox : `${inbox}/`;
  const result = spawnSync("scp", ["-q", pngPath, manifestPath, target], { encoding: "utf8", stdio: ["ignore", "inherit", "pipe"] });
  if (result.error || result.status !== 0) throw new Error(`Could not upload the share image to the bot: ${result.error?.message ?? result.stderr.trim()}`);
}
