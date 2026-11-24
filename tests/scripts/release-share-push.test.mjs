import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fuxiTarget, pushToWechat, wechatAnnouncement } from "../../scripts/release/share-push.mjs";

test("wechatAnnouncement keys on the version and marks betas", () => {
  const stable = wechatAnnouncement("0.4.0", "aW1n");
  assert.equal(stable.key, "fuyu-v0.4.0");
  assert.equal(stable.text, "浮屿 v0.4.0 已更新\n在 设置 → 关于 里更新\n更新说明：https://github.com/TixXin/fuyu/releases/tag/v0.4.0");
  assert.equal(stable.image_base64, "aW1n");
  assert.match(wechatAnnouncement("0.4.1-beta.2", "").text, /^浮屿 v0\.4\.1-beta\.2 已更新（测试版）\n/);
});

test("fuxiTarget needs a host and a directory", () => {
  assert.deepEqual(fuxiTarget("box:/srv/fuxi dir"), { host: "box", dir: "/srv/fuxi dir" });
  for (const bad of ["", "box", ":/srv", "box:"]) assert.throws(() => fuxiTarget(bad), /FUYU_FUXI/);
});

test("pushToWechat runs the remote script with the token in a curl config file", () => {
  const root = mkdtempSync(join(tmpdir(), "fuxi-push-"));
  const deploy = join(root, "it's deploy");
  const bin = join(root, "bin");
  mkdirSync(deploy);
  mkdirSync(bin);
  writeFileSync(join(deploy, ".env"), "FUXI_KERNEL_TOKEN=x\nFUXI_API_TOKEN=secret-token\nFUXI_API_PORT=9876\n");
  writeFileSync(join(root, "card.png"), "png-bytes");
  writeFileSync(join(bin, "curl"), [
    "#!/bin/sh",
    'out=$(cd "$(dirname "$0")/.." && pwd)',
    'printf \'%s\\n\' "$@" > "$out/args"',
    'while [ "$1" != "-K" ]; do shift; done; cat "$2" > "$out/config"',
    'cat > "$out/body"',
    `printf '{"ok":true,"created":true,"item":{"key":"fuyu-v0.4.0","code":"123","to":"用户群","status_zh":"等确认","created":1795519549.9}}'`,
  ].join("\n"));
  chmodSync(join(bin, "curl"), 0o755);
  let sshArgs;
  const run = (command, args, options) => {
    sshArgs = [command, ...args];
    return spawnSync("sh", ["-c", 'PATH="$(cd "$1" && pwd):$PATH"; export PATH; exec sh -c "$2"', "_", bin, args[1]], options);
  };
  const item = pushToWechat(join(root, "card.png"), "0.4.0", `box:${deploy}`, run);
  assert.equal(sshArgs[0], "ssh");
  assert.equal(sshArgs[1], "box");
  assert.deepEqual(item, { created: true, key: "fuyu-v0.4.0", code: "123", to: "用户群", status_zh: "等确认" });
  assert.equal(readFileSync(join(root, "config"), "utf8"), 'header = "Authorization: Bearer secret-token"\n');
  const args = readFileSync(join(root, "args"), "utf8");
  assert.ok(args.includes("http://127.0.0.1:9876/announce"));
  assert.ok(!args.includes("secret-token"));
  const body = JSON.parse(readFileSync(join(root, "body"), "utf8"));
  assert.equal(Buffer.from(body.image_base64, "base64").toString(), "png-bytes");
  assert.equal(body.key, "fuyu-v0.4.0");
});

test("pushToWechat reports what Fuxi refused", () => {
  const root = mkdtempSync(join(tmpdir(), "fuxi-push-"));
  writeFileSync(join(root, "card.png"), "x");
  const run = () => ({ status: 0, stdout: '{"ok":false,"error":"「用户群」匹配到 0 个会话"}', stderr: "" });
  assert.throws(() => pushToWechat(join(root, "card.png"), "0.4.0", "box:/d", run), /Fuxi refused the announcement: 「用户群」/);
  const down = () => ({ status: 255, stdout: "", stderr: "ssh: connect refused" });
  assert.throws(() => pushToWechat(join(root, "card.png"), "0.4.0", "box:/d", down), /Could not reach Fuxi on box: ssh: connect refused/);
});
