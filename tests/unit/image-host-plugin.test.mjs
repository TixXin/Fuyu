import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { review } from "../../packages/plugin-review/src/index.mjs";
import { encodeKey } from "../../plugins/v3/official/image-host/src/encode.ts";
import {
  DEFAULT_CONFIG,
  missingOf,
  normalizeConfig,
  objectKey,
  objectUrl,
  publicUrl,
} from "../../plugins/v3/official/image-host/src/model.ts";
import { sha256Hex, signRequest } from "../../plugins/v3/official/image-host/src/s3.ts";
import { testPicture } from "../../plugins/v3/official/image-host/src/upload.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/image-host", import.meta.url));
const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));
const ID = "@fuyu/image-host";
const scratch = mkdtempSync(join(tmpdir(), "fuyu-image-host-"));
const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
  rmSync(scratch, { recursive: true, force: true });
});

test("image-host signs requests exactly like the AWS Signature V4 example for PUT Object", () => {
  const url = new URL(`https://examplebucket.s3.amazonaws.com/${encodeKey("test$file.text")}`);
  const headers = signRequest({
    method: "PUT",
    url,
    headers: { Date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" },
    payloadHash: sha256Hex("Welcome to Amazon S3."),
    keys: { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" },
    region: "us-east-1",
    now: new Date("2013-05-24T00:00:00Z"),
  });
  assert.equal(url.pathname, "/test%24file.text");
  assert.equal(headers["x-amz-content-sha256"], "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072");
  assert.equal(
    headers.authorization,
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class, Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd",
  );
  assert.equal(headers.host, undefined);
});

test("image-host settings: cleaned on the way in, addresses built per provider style", () => {
  const config = normalizeConfig({
    endpoint: " https://abc123.r2.cloudflarestorage.com/ignored/path?x=1 ",
    region: "Not a region!",
    bucket: "shots",
    prefix: "\\a/../b//./c/",
    publicBase: "https://cdn.example.test/img///",
    copyAs: "html",
    pathStyle: "yes",
  });
  assert.deepEqual(config, {
    ...DEFAULT_CONFIG,
    endpoint: "https://abc123.r2.cloudflarestorage.com",
    region: "auto",
    bucket: "shots",
    prefix: "a/b/c/",
    publicBase: "https://cdn.example.test/img",
  });
  assert.deepEqual(missingOf(DEFAULT_CONFIG, { accessKeyId: false, secretAccessKey: false }), ["endpoint", "bucket", "keys"]);
  assert.deepEqual(missingOf({ ...config, endpoint: "http://example.test" }, { accessKeyId: true, secretAccessKey: true }), ["endpoint"]);
  assert.deepEqual(missingOf({ ...config, bucket: "Bad_Bucket" }, { accessKeyId: true, secretAccessKey: false }), ["bucket", "keys"]);

  const key = objectKey("fuyu/", new Date(2026, 10, 20, 9, 5, 7), "a1b2c3");
  assert.equal(key, "fuyu/2026/11/20261120-090507-a1b2c3.png");
  assert.equal(objectUrl(config, "x/截图 1.png").href, "https://shots.abc123.r2.cloudflarestorage.com/x/%E6%88%AA%E5%9B%BE%201.png");
  assert.equal(objectUrl({ ...config, pathStyle: true }, "x/a.png").href, "https://abc123.r2.cloudflarestorage.com/shots/x/a.png");
  assert.equal(objectUrl({ ...config, endpoint: "http://localhost:9000" }, "x/a.png").href, "http://localhost:9000/shots/x/a.png");
  assert.equal(publicUrl(config, "x/a b.png"), "https://cdn.example.test/img/x/a%20b.png");
  assert.equal(publicUrl({ ...config, publicBase: "" }, "x/a.png"), "https://shots.abc123.r2.cloudflarestorage.com/x/a.png");
});

function fakeRust() {
  const toHost = new PassThrough();
  const fromHost = new PassThrough();
  const vault = new Map();
  const copied = [];
  let listFailures = 1;
  const names = (plugin) => [...vault.keys()].filter((key) => key.startsWith(`${plugin}\n`)).map((key) => key.split("\n")[1]).sort();
  const methods = {
    "pluginKernel.secretList": ({ plugin }) => {
      if (listFailures-- > 0) throw Object.assign(new Error("the keychain is locked"), { code: "failed" });
      return { names: names(plugin) };
    },
    "pluginKernel.secretGet": ({ plugin, name }) => ({ value: vault.get(`${plugin}\n${name}`) ?? null }),
    "pluginKernel.secretSet": ({ plugin, name, value }) => (vault.set(`${plugin}\n${name}`, value), { names: names(plugin) }),
    "pluginKernel.secretRemove": ({ plugin, name }) => (vault.delete(`${plugin}\n${name}`), { names: names(plugin) }),
    "clipboard.copyText": ({ text }) => (copied.push(text), null),
  };
  const write = (message) => toHost.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  createInterface({ input: fromHost }).on("line", async (line) => {
    const message = JSON.parse(line);
    if (message.id === undefined) return;
    const method = methods[message.method];
    if (!method) return write({ id: message.id, error: { code: "no-method", message: `no ${message.method}` } });
    try {
      write({ id: message.id, result: await method(message.params) });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message } });
    }
  });
  return { rpc: connect({ input: toHost, write: (text) => fromHost.write(text) }), vault, copied };
}

function verifySignature(request, body, secret) {
  const auth = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/.exec(request.headers.authorization ?? "");
  if (!auth) return "no authorization";
  const [, , day, region, signed, signature] = auth;
  const hash = createHash("sha256").update(body).digest("hex");
  if (request.headers["x-amz-content-sha256"] !== hash) return "payload hash";
  const names = signed.split(";");
  const canonical = [request.method, request.url, "", names.map((name) => `${name}:${request.headers[name]}\n`).join(""), signed, hash].join("\n");
  const stamp = request.headers["x-amz-date"];
  const toSign = ["AWS4-HMAC-SHA256", stamp, `${day}/${region}/s3/aws4_request`, createHash("sha256").update(canonical).digest("hex")].join("\n");
  let key = createHmac("sha256", `AWS4${secret}`).update(day).digest();
  for (const part of [region, "s3", "aws4_request"]) key = createHmac("sha256", key).update(part).digest();
  return createHmac("sha256", key).update(toSign).digest("hex") === signature ? null : "signature";
}

async function fakeBucket(secret) {
  const puts = [];
  let reply = null;
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      puts.push({ method: request.method, url: request.url, type: request.headers["content-type"], body, problem: verifySignature(request, body, secret) });
      if (reply) return response.writeHead(reply.status, { "content-type": "application/xml" }).end(reply.body);
      response.writeHead(200).end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise((resolve) => server.close(resolve)));
  return { port: server.address().port, puts, fail: (status, code) => (reply = status ? { status, body: `<Error><Code>${code}</Code></Error>` } : null) };
}

async function until(check, ms = 5000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return check();
}

test("image-host: passes the market checks, uploads from the screenshot card and keeps the keys out of its files", async () => {
  const result = await check(PLUGIN_DIR, { official: true, allowExperimental: false });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, "built"), packDir: join(scratch, "packed") });
  assert.deepEqual(packed.manifest.fuyu.nodeApis, ["crypto", "fs", "path"]);
  const report = review({ oldDir: null, newDir: PLUGIN_DIR, newBuilt: packed.outDir });
  assert.deepEqual(report.findings.filter((item) => item.tier === "red"), []);
  assert.deepEqual(report.summary.network.undeclared, []);

  const dir = join(scratch, "host");
  mkdirSync(dir, { recursive: true });
  installPackage(packed.file, { dir, source: "market", official: true, expectedSha256: packed.sha256 });
  const rust = fakeRust();
  const bucket = await fakeBucket("s3cr3t-key");
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc, appVersion: "0.3.12" });
  cleanup.push(() => host.stop());
  await host.settle();
  assert.ok(await until(() => host.status().find((entry) => entry.id === ID)?.state === "running"), JSON.stringify(host.status().find((entry) => entry.id === ID)));

  const call = (method, params) => host.ctx.clients.call(ID, method, params);
  const card = (method, params) => host.serviceHub.callFromWindow({ service: "screenshot.actions/v1", method, params }, "island");
  const picture = join(scratch, "shot.png");
  writeFileSync(picture, testPicture());
  const upload = () => card("run", { id: "image-host.upload", context: { path: picture, locale: "en" } });

  const first = await call("state");
  assert.deepEqual([first.missing, first.error], [["endpoint", "bucket", "keys"], null], "a failed first read of the credential store is retried");
  const listed = (await card("list", {})).actions.find((item) => item.id === "image-host.upload");
  assert.deepEqual([listed.label, listed.icon, listed.disabled], [{ "zh-CN": "上传图床", en: "Upload" }, "share", false]);
  assert.equal((await upload()).message, "Set up the image host first. Opening the settings.");

  await call("setConfig", { endpoint: `http://127.0.0.1:${bucket.port}`, bucket: "shots", region: "us-east-1", publicBase: "https://cdn.example.test/img/", copyAs: "markdown" });
  const saved = await call("saveKeys", { accessKeyId: "AKIDEXAMPLE", secretAccessKey: " s3cr3t-key " });
  assert.deepEqual([saved.missing, saved.keys], [[], { accessKeyId: true, secretAccessKey: true }]);
  assert.equal(rust.vault.get(`${ID}\nsecret-access-key`), "s3cr3t-key");
  assert.doesNotMatch(JSON.stringify(saved), /s3cr3t|AKIDEXAMPLE/);

  assert.deepEqual(await upload(), { message: "Uploaded. Link copied.", dismiss: false });
  const put = bucket.puts.at(-1);
  assert.deepEqual([put.method, put.type, put.problem], ["PUT", "image/png", null]);
  assert.match(put.url, /^\/shots\/fuyu\/\d{4}\/\d{2}\/\d{8}-\d{6}-[0-9a-f]{6}\.png$/);
  assert.deepEqual([...put.body], [...testPicture()]);
  assert.equal(rust.copied.at(-1), `![](https://cdn.example.test/img${put.url.slice("/shots".length)})`);

  bucket.fail(403, "SignatureDoesNotMatch");
  assert.equal((await upload()).message, "Upload refused: check the keys, the region and the bucket's permissions.");
  assert.deepEqual((await call("state")).error, { reason: "auth", status: 403, code: "SignatureDoesNotMatch" });
  bucket.fail(503, "SlowDown");
  assert.equal((await upload()).message, "Upload failed (HTTP 503, SlowDown).");
  bucket.fail(null);

  const tested = await call("test");
  assert.deepEqual([tested.error, tested.busy, tested.last.test, tested.last.url], [null, false, true, "https://cdn.example.test/img/fuyu/fuyu-image-host-test.png"]);
  assert.equal(bucket.puts.at(-1).url, "/shots/fuyu/fuyu-image-host-test.png");

  await call("setConfig", { endpoint: "https://storage.example.test" });
  const before = bucket.puts.length;
  assert.equal((await upload()).message, "This plugin can't connect to that endpoint. It works with R2, S3, OSS, COS and MinIO on this computer.");
  assert.equal(bucket.puts.length, before);

  const cleared = await call("clearKeys");
  assert.deepEqual([cleared.keys, cleared.missing], [{ accessKeyId: false, secretAccessKey: false }, ["keys"]]);
  assert.equal(rust.vault.size, 0);
  const stored = readFileSync(join(dir, "data", "@fuyu", "image-host", "config.json"), "utf8");
  assert.match(stored, /"bucket": "shots"/);
  assert.doesNotMatch(stored, /s3cr3t|AKIDEXAMPLE/);
});
