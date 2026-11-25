import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import { createProxyFetch, shouldBypassProxy } from "../src/host/proxy.mjs";

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

test("shouldBypassProxy matches loopback, wildcards, suffixes, and <local>", () => {
  assert.equal(shouldBypassProxy("localhost", []), true);
  assert.equal(shouldBypassProxy("127.0.0.1", []), true);
  assert.equal(shouldBypassProxy("api.github.com", ["*.corp.local", ".internal.net", "<local>"]), false);
  assert.equal(shouldBypassProxy("git.corp.local", ["*.corp.local"]), true);
  assert.equal(shouldBypassProxy("corp.local", ["*.corp.local"]), true);
  assert.equal(shouldBypassProxy("mail.internal.net", [".internal.net"]), true);
  assert.equal(shouldBypassProxy("intranet", ["<local>"]), true);
  assert.equal(shouldBypassProxy("10.2.3.4", ["10.*"]), true);
});

test("createProxyFetch forwards HTTP requests with Basic auth and respects bypass and dynamic config updates", async () => {
  const seen = [];
  const proxyServer = http.createServer((req, res) => {
    seen.push({ url: req.url, method: req.method, auth: req.headers["proxy-authorization"] });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ proxied: true, target: req.url }));
  });
  const proxyPort = await listen(proxyServer);

  const directCalls = [];
  const baseFetch = async (input) => {
    directCalls.push(String(input));
    return new Response("direct", { status: 200 });
  };

  try {
    const pf = createProxyFetch(baseFetch);
    const directRes = await pf.fetch("http://example.com/a");
    assert.equal(await directRes.text(), "direct");
    assert.deepEqual(directCalls, ["http://example.com/a"]);

    pf.setConfig({ url: `http://alice:s3cret@127.0.0.1:${proxyPort}`, bypass: ["*.corp.local"] });
    const proxiedRes = await pf.fetch("http://example.com/index.v3.json", { headers: { accept: "application/json" } });
    assert.equal(proxiedRes.status, 200);
    assert.deepEqual(await proxiedRes.json(), { proxied: true, target: "http://example.com/index.v3.json" });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].auth, `Basic ${Buffer.from("alice:s3cret").toString("base64")}`);

    const bypassedRes = await pf.fetch("http://git.corp.local/repo");
    assert.equal(await bypassedRes.text(), "direct");
    assert.equal(directCalls.length, 2);

    pf.setConfig(null);
    const afterClear = await pf.fetch("http://example.com/after");
    assert.equal(await afterClear.text(), "direct");
    assert.equal(directCalls.length, 3);
  } finally {
    await close(proxyServer);
  }
});

test("createProxyFetch routes HTTP traffic through a SOCKS5 proxy with username/password auth", async () => {
  const targetServer = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`target:${req.url}`);
  });
  const targetPort = await listen(targetServer);

  const socksServer = net.createServer((client) => {
    let stage = 0;
    let buf = Buffer.alloc(0);
    let upstream = null;
    client.on("data", (chunk) => {
      if (upstream) {
        upstream.write(chunk);
        return;
      }
      buf = Buffer.concat([buf, chunk]);
      if (stage === 0 && buf.length >= 4) {
        assert.deepEqual([...buf.subarray(0, 4)], [0x05, 0x02, 0x00, 0x02]);
        buf = buf.subarray(4);
        stage = 1;
        client.write(Buffer.from([0x05, 0x02]));
      }
      if (stage === 1 && buf.length >= 2) {
        const ulen = buf[1];
        if (buf.length < 2 + ulen + 1) return;
        const plen = buf[2 + ulen];
        if (buf.length < 3 + ulen + plen) return;
        const user = buf.subarray(2, 2 + ulen).toString("utf8");
        const pass = buf.subarray(3 + ulen, 3 + ulen + plen).toString("utf8");
        assert.equal(user, "bob");
        assert.equal(pass, "pw");
        buf = buf.subarray(3 + ulen + plen);
        stage = 2;
        client.write(Buffer.from([0x01, 0x00]));
      }
      if (stage === 2 && buf.length >= 5) {
        assert.equal(buf[0], 0x05);
        assert.equal(buf[1], 0x01);
        assert.equal(buf[3], 0x03);
        const hlen = buf[4];
        if (buf.length < 5 + hlen + 2) return;
        const host = buf.subarray(5, 5 + hlen).toString("utf8");
        const port = buf.readUInt16BE(5 + hlen);
        assert.equal(host, "market.example");
        assert.equal(port, targetPort);
        const leftover = buf.subarray(5 + hlen + 2);
        buf = Buffer.alloc(0);
        stage = 3;
        upstream = net.connect({ host: "127.0.0.1", port: targetPort }, () => {
          client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
          if (leftover.length > 0) upstream.write(leftover);
        });
        upstream.pipe(client);
      }
    });
  });
  const socksPort = await listen(socksServer);

  try {
    const pf = createProxyFetch();
    pf.setConfig({ url: `socks5h://bob:pw@127.0.0.1:${socksPort}`, bypass: [] });
    const res = await pf.fetch(`http://market.example:${targetPort}/plugins.json`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "target:/plugins.json");
  } finally {
    await close(socksServer);
    await close(targetServer);
  }
});
