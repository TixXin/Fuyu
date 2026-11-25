import http from "node:http";
import https from "node:https";
import net from "node:net";

export function authHeader(proxy) {
  if (!proxy.username) return null;
  return `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64")}`;
}

export function formatAuthority(hostname, port) {
  const clean = hostname.replace(/^\[|\]$/g, "");
  return clean.includes(":") ? `[${clean}]:${port}` : `${clean}:${port}`;
}

export function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
}

export function openHttpConnectTunnel(proxy, targetHost, targetPort, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const authority = formatAuthority(targetHost, targetPort);
    const headers = { Host: authority, "Proxy-Connection": "Keep-Alive" };
    const auth = authHeader(proxy);
    if (auth) headers["Proxy-Authorization"] = auth;
    const transport = proxy.scheme === "https" ? https : http;
    const req = transport.request({
      host: proxy.host,
      port: proxy.port,
      method: "CONNECT",
      path: authority,
      headers,
    });
    const onAbort = () => req.destroy(abortError(signal));
    signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    req.once("connect", (res, socket, head) => {
      cleanup();
      if (res.statusCode < 200 || res.statusCode >= 300) {
        socket.destroy();
        reject(new Error(`proxy CONNECT failed with HTTP ${res.statusCode}`));
        return;
      }
      if (head && head.length > 0) socket.unshift(head);
      resolve(socket);
    });
    req.once("error", (error) => {
      cleanup();
      reject(error);
    });
    req.end();
  });
}

function readExact(socket, count, buffered, signal) {
  return new Promise((resolve, reject) => {
    if (buffered.length >= count) {
      return resolve({ chunk: buffered.subarray(0, count), rest: buffered.subarray(count) });
    }
    let acc = buffered;
    const onAbort = () => {
      cleanup();
      socket.destroy();
      reject(abortError(signal));
    };
    const onData = (data) => {
      acc = Buffer.concat([acc, data]);
      if (acc.length >= count) {
        cleanup();
        resolve({ chunk: acc.subarray(0, count), rest: acc.subarray(count) });
      }
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("SOCKS5 proxy closed connection unexpectedly"));
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("end", onEnd);
      socket.off("close", onEnd);
      socket.off("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    socket.on("data", onData);
    socket.once("end", onEnd);
    socket.once("close", onEnd);
    socket.once("error", onError);
  });
}

export async function openSocks5Tunnel(proxy, targetHost, targetPort, signal) {
  if (signal?.aborted) throw abortError(signal);
  const socket = await new Promise((resolve, reject) => {
    const conn = net.connect({ host: proxy.host, port: proxy.port });
    const onAbort = () => {
      conn.destroy();
      reject(abortError(signal));
    };
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    signal?.addEventListener("abort", onAbort, { once: true });
    conn.once("connect", () => {
      cleanup();
      resolve(conn);
    });
    conn.once("error", (error) => {
      cleanup();
      reject(error);
    });
  });

  try {
    let rest = Buffer.alloc(0);
    const useAuth = Boolean(proxy.username);
    socket.write(Buffer.from(useAuth ? [0x05, 0x02, 0x00, 0x02] : [0x05, 0x01, 0x00]));
    let reply = await readExact(socket, 2, rest, signal);
    rest = reply.rest;
    if (reply.chunk[0] !== 0x05) throw new Error("proxy is not SOCKS5");
    if (reply.chunk[1] === 0x02) {
      if (!useAuth) throw new Error("SOCKS5 proxy requires authentication");
      const user = Buffer.from(proxy.username, "utf8");
      const pass = Buffer.from(proxy.password, "utf8");
      if (user.length > 255 || pass.length > 255) throw new Error("SOCKS5 credentials are too long");
      socket.write(Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]));
      reply = await readExact(socket, 2, rest, signal);
      rest = reply.rest;
      if (reply.chunk[1] !== 0x00) throw new Error("SOCKS5 authentication failed");
    } else if (reply.chunk[1] !== 0x00) {
      throw new Error(`SOCKS5 proxy rejected auth method (${reply.chunk[1]})`);
    }

    const cleanHost = targetHost.replace(/^\[|\]$/g, "");
    const hostBuf = Buffer.from(cleanHost, "utf8");
    const portBuf = Buffer.alloc(2);
    portBuf.writeUInt16BE(targetPort, 0);
    socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]), hostBuf, portBuf]));

    reply = await readExact(socket, 4, rest, signal);
    rest = reply.rest;
    if (reply.chunk[0] !== 0x05) throw new Error("invalid SOCKS5 connect reply");
    if (reply.chunk[1] !== 0x00) throw new Error(`SOCKS5 connect failed (code ${reply.chunk[1]})`);
    const atyp = reply.chunk[3];
    if (atyp === 0x01) {
      reply = await readExact(socket, 6, rest, signal);
      rest = reply.rest;
    } else if (atyp === 0x03) {
      reply = await readExact(socket, 1, rest, signal);
      rest = reply.rest;
      reply = await readExact(socket, reply.chunk[0] + 2, rest, signal);
      rest = reply.rest;
    } else if (atyp === 0x04) {
      reply = await readExact(socket, 18, rest, signal);
      rest = reply.rest;
    } else {
      throw new Error(`unknown SOCKS5 address type ${atyp}`);
    }
    if (rest.length > 0) socket.unshift(rest);
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}
