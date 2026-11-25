import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { abortError, authHeader, openHttpConnectTunnel, openSocks5Tunnel } from "./proxy-tunnel.mjs";

const MAX_REDIRECTS = 10;
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function isLoopback(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1";
}

export function shouldBypassProxy(hostname, bypass = []) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || isLoopback(host)) return true;
  for (const raw of bypass) {
    const pattern = String(raw ?? "").trim().toLowerCase();
    if (!pattern) continue;
    if (pattern === "*") return true;
    if (pattern === "<local>") {
      if (!host.includes(".")) return true;
      continue;
    }
    const stripped = pattern.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
    if (stripped.startsWith("*.")) {
      const suffix = stripped.slice(2);
      if (host === suffix || host.endsWith(`.${suffix}`)) return true;
    } else if (stripped.startsWith(".")) {
      const suffix = stripped.slice(1);
      if (host === suffix || host.endsWith(`.${suffix}`)) return true;
    } else if (stripped.endsWith(".*")) {
      if (host.startsWith(stripped.slice(0, -1))) return true;
    } else if (host === stripped) {
      return true;
    }
  }
  return false;
}

function normalizeProxyConfig(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.url !== "string" || !raw.url.trim()) return null;
  let parsed;
  try {
    parsed = new URL(raw.url.trim());
  } catch {
    return null;
  }
  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (!["http", "https", "socks5", "socks5h", "socks"].includes(scheme)) return null;
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!host) return null;
  const defaultPort = scheme === "https" ? 443 : scheme.startsWith("socks") ? 1080 : 80;
  const port = parsed.port ? Number(parsed.port) : defaultPort;
  const username = parsed.username ? decodeURIComponent(parsed.username) : "";
  const password = parsed.password ? decodeURIComponent(parsed.password) : "";
  const bypass = Array.isArray(raw.bypass) ? raw.bypass.map((item) => String(item).trim()).filter(Boolean) : [];
  return { scheme, host, port, username, password, bypass };
}

async function normalizeBody(body) {
  if (body == null) return null;
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString(), "utf8");
  if (typeof body.arrayBuffer === "function") return Buffer.from(await body.arrayBuffer());
  return Buffer.from(String(body), "utf8");
}

function collectHeaders(initHeaders, requestHeaders) {
  const out = {};
  const merged = new Headers(requestHeaders ?? undefined);
  if (initHeaders) {
    for (const [key, value] of new Headers(initHeaders).entries()) merged.set(key, value);
  }
  for (const [key, value] of merged.entries()) out[key] = value;
  return out;
}

async function sendOnce(proxy, url, method, headers, bodyBuf, signal) {
  if (signal?.aborted) throw abortError(signal);
  const isHttps = url.protocol === "https:";
  const targetPort = url.port ? Number(url.port) : isHttps ? 443 : 80;
  const targetHost = url.hostname.replace(/^\[|\]$/g, "");
  const isSocks = proxy.scheme.startsWith("socks");

  let socket = null;
  let transport = isHttps ? https : http;
  let options;

  if (!isSocks && !isHttps) {
    transport = proxy.scheme === "https" ? https : http;
    const reqHeaders = { ...headers, host: url.host };
    const auth = authHeader(proxy);
    if (auth && !reqHeaders["proxy-authorization"]) reqHeaders["proxy-authorization"] = auth;
    options = {
      host: proxy.host,
      port: proxy.port,
      method,
      path: url.toString(),
      headers: reqHeaders,
      agent: false,
    };
  } else {
    const rawSocket = isSocks
      ? await openSocks5Tunnel(proxy, targetHost, targetPort, signal)
      : await openHttpConnectTunnel(proxy, targetHost, targetPort, signal);
    socket = isHttps
      ? await new Promise((resolve, reject) => {
          const tlsSocket = tls.connect({ socket: rawSocket, servername: net.isIP(targetHost) ? undefined : targetHost });
          const onAbort = () => {
            tlsSocket.destroy();
            reject(abortError(signal));
          };
          const cleanup = () => signal?.removeEventListener("abort", onAbort);
          signal?.addEventListener("abort", onAbort, { once: true });
          tlsSocket.once("secureConnect", () => {
            cleanup();
            resolve(tlsSocket);
          });
          tlsSocket.once("error", (error) => {
            cleanup();
            reject(error);
          });
        })
      : rawSocket;
    const tunnelAgent = new transport.Agent({ keepAlive: false });
    tunnelAgent.createConnection = () => socket;
    options = {
      method,
      path: `${url.pathname}${url.search}`,
      headers: { ...headers, host: url.host },
      agent: tunnelAgent,
    };
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.once("end", () => {
        cleanup();
        const resHeaders = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) {
            for (const entry of value) resHeaders.append(key, entry);
          } else if (typeof value === "string") {
            resHeaders.set(key, value);
          }
        }
        const status = res.statusCode ?? 200;
        const payload = NULL_BODY_STATUSES.has(status) ? null : Buffer.concat(chunks);
        resolve(new Response(payload, { status, statusText: res.statusMessage ?? "", headers: resHeaders }));
      });
      res.once("error", (error) => {
        cleanup();
        reject(error);
      });
    });
    const onAbort = () => {
      req.destroy(abortError(signal));
      socket?.destroy();
    };
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    signal?.addEventListener("abort", onAbort, { once: true });
    req.once("error", (error) => {
      cleanup();
      socket?.destroy();
      reject(error);
    });
    if (bodyBuf && bodyBuf.length > 0) req.write(bodyBuf);
    req.end();
  });
}

export function createProxyFetch(baseFetch = globalThis.fetch) {
  let active = null;

  const fetchWithProxy = async (input, init = {}) => {
    const proxy = active;
    if (!proxy) return init === undefined ? baseFetch(input) : baseFetch(input, init);
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return baseFetch(input, init);
    }
    if ((url.protocol !== "http:" && url.protocol !== "https:") || shouldBypassProxy(url.hostname, proxy.bypass)) {
      return baseFetch(input, init);
    }

    let method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const redirectMode = init?.redirect ?? (input instanceof Request ? input.redirect : "follow");
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    let headers = collectHeaders(init?.headers, input instanceof Request ? input.headers : undefined);
    let bodyBuf = init?.body !== undefined
      ? await normalizeBody(init.body)
      : input instanceof Request && method !== "GET" && method !== "HEAD"
        ? Buffer.from(await input.arrayBuffer())
        : null;
    if (bodyBuf && !Object.keys(headers).some((k) => k.toLowerCase() === "content-length")) {
      headers["content-length"] = String(bodyBuf.length);
    }

    let currentUrl = url;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await sendOnce(proxy, currentUrl, method, headers, bodyBuf, signal);
      const location = response.headers.get("location");
      const isRedirect = [301, 302, 303, 307, 308].includes(response.status) && Boolean(location);
      if (!isRedirect || redirectMode === "manual") return response;
      if (redirectMode === "error") throw new TypeError("redirect mode is set to error");
      if (redirects === MAX_REDIRECTS) throw new TypeError("maximum redirect count reached");
      const nextUrl = new URL(location, currentUrl);
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
        method = "GET";
        bodyBuf = null;
        delete headers["content-length"];
        delete headers["content-type"];
      }
      if (nextUrl.origin !== currentUrl.origin) {
        delete headers.authorization;
      }
      currentUrl = nextUrl;
      if (shouldBypassProxy(currentUrl.hostname, proxy.bypass)) {
        return baseFetch(currentUrl, { method, headers, body: bodyBuf ?? undefined, signal, redirect: redirectMode });
      }
    }
    throw new TypeError("maximum redirect count reached");
  };

  return {
    fetch: fetchWithProxy,
    setConfig(next) {
      active = normalizeProxyConfig(next);
    },
    getConfig() {
      return active;
    },
  };
}
