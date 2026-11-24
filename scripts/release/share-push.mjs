import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const BOT_INBOX_ENV = "FUYU_BOT_INBOX";
export const FUXI_ENV = "FUYU_FUXI";

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

export function wechatAnnouncement(version, imageBase64) {
  const { channel, url } = shareManifest(version, "");
  const text = [`浮屿 v${version} 已更新${channel === "beta" ? "（测试版）" : ""}`, "在 设置 → 关于 里更新", `更新说明：${url}`].join("\n");
  return { key: `fuyu-v${version}`, text, image_base64: imageBase64, image_name: `fuyu-v${version}.png` };
}

export function fuxiTarget(value) {
  const at = String(value ?? "").indexOf(":");
  if (at <= 0 || at === value.length - 1) throw new Error(`${FUXI_ENV} must look like <ssh host>:<Fuxi deploy dir>.`);
  return { host: value.slice(0, at), dir: value.slice(at + 1) };
}

const quote = (text) => `'${text.replace(/'/g, `'\\''`)}'`;

const ANNOUNCE = [
  'set -e; cd "$1"; umask 077; t=$(mktemp); trap "rm -f $t" EXIT',
  'printf "header = \\"Authorization: Bearer %s\\"\\n" "$(sed -n "s/^FUXI_API_TOKEN=//p" .env)" > "$t"',
  'port=$(sed -n "s/^FUXI_API_PORT=//p" .env)',
  'curl -sS --max-time 300 -K "$t" -X POST "http://127.0.0.1:${port:-8790}/announce" -H "Content-Type: application/json" --data-binary @-',
].join("; ");

export function pushToWechat(pngPath, version, value = process.env[FUXI_ENV], run = spawnSync) {
  if (!value) throw new Error(`Set ${FUXI_ENV} to <ssh host>:<Fuxi deploy dir> to post to WeChat.`);
  const { host, dir } = fuxiTarget(value);
  const body = JSON.stringify(wechatAnnouncement(version, readFileSync(pngPath).toString("base64")));
  const result = run("ssh", [host, `sh -c ${quote(ANNOUNCE)} fuxi ${quote(dir)}`], { input: body, encoding: "utf8", maxBuffer: 1 << 20 });
  if (result.error || result.status !== 0) throw new Error(`Could not reach Fuxi on ${host}: ${result.error?.message ?? result.stderr.trim()}`);
  let reply;
  try {
    reply = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Fuxi answered with something that is not JSON: ${result.stdout.slice(0, 200)}`);
  }
  if (!reply.ok) throw new Error(`Fuxi refused the announcement: ${reply.error}`);
  return { ...reply.item, created: reply.created };
}
