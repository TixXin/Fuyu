import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { readManifest } from "../pack.mjs";
import { protocol } from "../schema.mjs";
import { PERMISSION_DENIED, RpcError, answer, emptyTodos } from "./methods.mjs";

const DEFAULT_TIMEOUT_MS = 10_000;
const STOP_GRACE_MS = 3_000;

export function launchCommand(dir, runtime) {
  if (runtime?.type !== "process") throw new Error("The plugin has no process (runtime.type is not \"process\").");
  const script = path.join(dir, runtime.command);
  const extra = runtime.args ?? [];
  const extension = path.extname(runtime.command).toLowerCase();
  if (extension === ".ps1") {
    const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
    return [shell, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, ...extra]];
  }
  if ([".js", ".mjs", ".cjs"].includes(extension)) return [process.execPath, [script, ...extra]];
  return [script, extra];
}

function resolveSettings(manifest, overrides) {
  const values = {};
  for (const spec of manifest.contributes?.settings ?? []) {
    if (spec.default !== undefined) values[spec.key] = spec.default;
    else values[spec.key] = { boolean: false, number: spec.min ?? 0, string: "", select: spec.options?.[0]?.value ?? "" }[spec.type];
  }
  return { ...values, ...overrides };
}

const pluginEnv = (prefix, host) => ({
  [`${prefix}_PLUGIN_ID`]: host.manifest.id,
  [`${prefix}_PLUGIN_DATA_DIR`]: host.dataDir,
  [`${prefix}_PLUGIN_API_VERSION`]: String(host.apiVersion),
});

export class MockHost extends EventEmitter {
  constructor(dir, options = {}) {
    super();
    this.dir = path.resolve(dir);
    this.manifest = readManifest(this.dir);
    this.apiVersion = this.manifest.apiVersion;
    this.granted = options.permissions ?? this.manifest.permissions ?? [];
    this.denied = new Set(options.deny ?? []);
    this.optional = this.apiVersion >= 2 ? (this.manifest.optionalPermissions ?? []).filter((name) => !this.granted.includes(name)) : [];
    this.allowedOptional = new Set();
    this.settings = resolveSettings(this.manifest, options.settings);
    this.activationEvent = options.activationEvent ?? "onStartup";
    this.appVersion = options.appVersion ?? "99.0.0-mock";
    this.ownDataDir = !options.dataDir;
    this.dataDir = options.dataDir ?? mkdtempSync(path.join(os.tmpdir(), "fuyu-mock-"));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.todos = options.todos ? structuredClone(options.todos) : emptyTodos();
    this.archives = structuredClone(options.archives ?? []);
    this.note = options.note ?? "";
    this.data = {
      clipboard: options.clipboard ?? [],
      messages: options.messages ?? [],
      media: options.media ?? { available: false, status: "stopped", title: "", artist: "", album: "", sourceApp: "", positionMs: 0, durationMs: 0, canSeek: false, canNext: false, canPrevious: false, shuffle: null, repeat: "unknown", volume: null },
      cover: options.cover ?? null,
      shelf: options.shelf ?? [],
    };
    this.muted = Boolean(options.muted);
    this.requests = [];
    this.logs = [];
    this.views = new Map();
    this.statuses = new Map();
    this.openWebviews = new Set();
    this.webviewMessages = [];
    this.notifications = [];
    this.info = [];
    this.keepAlive = null;
    this.openedViews = [];
    this.storage = new Map(Object.entries(options.storage ?? {}));
    this.secrets = new Map(Object.entries(options.secrets ?? {}));
    this.subscriptions = new Set();
    this.agentStatuses = new Map();
    this.notifyTimes = [];
    this.nextTodoId = 1;
    this.exitCode = undefined;
  }

  capabilities() {
    return protocol().rpc.capabilities.filter((item) => item.since <= this.apiVersion).map((item) => item.name);
  }

  initializeParams() {
    const params = {
      apiVersion: this.apiVersion,
      capabilities: this.apiVersion >= 2 ? this.capabilities() : [],
      appVersion: this.appVersion,
      pluginId: this.manifest.id,
      dataDir: this.dataDir,
      permissions: [...this.granted, ...this.allowedOptional],
      settings: { ...this.settings },
    };
    if (this.apiVersion >= 2) {
      params.activationEvent = this.activationEvent;
      params.optionalPermissions = [...this.optional];
    }
    return params;
  }

  checkPermission(permission) {
    if (this.optional.includes(permission) && !this.allowedOptional.has(permission)) {
      throw new RpcError(PERMISSION_DENIED, `The user has not allowed the optional "${permission}" permission; ask with permissions.request first.`);
    }
    if (!this.granted.includes(permission) && !this.allowedOptional.has(permission)) throw new RpcError(PERMISSION_DENIED, `The plugin was not given the "${permission}" permission.`);
    if (this.denied.has(permission)) throw new RpcError(PERMISSION_DENIED, `The user did not allow the "${permission}" permission.`);
  }

  start(command) {
    const [program, args] = command ?? launchCommand(this.dir, this.manifest.runtime);
    this.child = spawn(program, args, {
      cwd: this.dir,
      env: { ...process.env, ...pluginEnv("FUYU", this), ...pluginEnv("FOCUSD", this) },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.exited = new Promise((resolve) => {
      this.child.on("error", (error) => {
        this.logs.push(`stderr: ${error.message}`);
        this.exitCode = null;
        this.emit("change");
        resolve(null);
      });
      this.child.on("exit", (code) => {
        this.exitCode = code;
        this.emit("change");
        resolve(code);
      });
    });
    this.child.stdin.on("error", () => {});
    readline.createInterface({ input: this.child.stdout }).on("line", (line) => this.receive(line));
    readline.createInterface({ input: this.child.stderr }).on("line", (line) => {
      this.logs.push(`stderr: ${line}`);
      this.emit("change");
    });
    this.send("initialize", this.initializeParams());
    return this;
  }

  receive(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.logs.push(`not JSON on stdout: ${line.slice(0, 200)}`);
      this.emit("change");
      return;
    }
    if (message?.method === "log") {
      this.logs.push(String(message.params?.message ?? ""));
    } else if (message?.id !== undefined && typeof message.method === "string") {
      const request = { method: message.method, params: message.params };
      this.requests.push(request);
      try {
        request.result = answer(this, message.method, message.params);
        this.write({ id: message.id, result: request.result });
      } catch (error) {
        const code = error instanceof RpcError ? error.code : -32000;
        request.error = { code, message: error.message, data: error.data };
        this.write({ id: message.id, error: request.error });
      }
    }
    this.emit("change");
  }

  write(message) {
    if (this.child?.stdin.writable) this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  }

  send(method, params = {}) {
    this.write({ method, params });
  }

  command(id, args) {
    this.send("command", args === undefined ? { id } : { id, args });
  }

  openUri(path = "", query = "") {
    const id = this.manifest?.id ?? "plugin";
    this.send("uri", { uri: `focusd://plugin/${id}${path}${query ? `?${query}` : ""}`, path, query });
  }

  publish(name, payload = {}) {
    if (!this.subscriptions.has(name)) return false;
    this.send("event", { name, payload });
    return true;
  }

  changeSettings(values) {
    this.settings = { ...this.settings, ...values };
    this.send("settings.changed", { settings: { ...this.settings } });
  }

  viewVisible(viewId, visible = true) {
    if (visible) this.openWebviews.add(viewId);
    else this.openWebviews.delete(viewId);
    this.send("view.visible", { viewId, visible });
  }

  webviewMessage(viewId, message) {
    this.send("webview.message", { viewId, message });
  }

  viewAction(viewId, actionId, extra = {}) {
    this.send("view.action", { viewId, actionId, ...extra });
  }

  viewSubmit(viewId, values) {
    this.send("view.submit", { viewId, values });
  }

  viewSearch(viewId, query) {
    this.send("view.search", { viewId, query });
  }

  notificationAction(id) {
    this.send("notification.action", { id });
  }

  waitFor(predicate, timeoutMs = this.timeoutMs) {
    return new Promise((resolve, reject) => {
      const check = () => {
        let value;
        try {
          value = predicate(this);
        } catch (error) {
          finish();
          reject(error);
          return;
        }
        if (value) {
          finish();
          resolve(value);
        } else if (this.exitCode !== undefined) {
          finish();
          reject(new Error(`The plugin exited (code ${this.exitCode}) before the condition was met. Log:\n${this.logs.slice(-20).join("\n")}`));
        }
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`Timed out after ${timeoutMs} ms. Log:\n${this.logs.slice(-20).join("\n")}`));
      }, timeoutMs);
      const finish = () => {
        clearTimeout(timer);
        this.off("change", check);
      };
      this.on("change", check);
      check();
    });
  }

  waitForRequest(method, from = 0) {
    return this.waitFor((host) => host.requests.slice(from).find((request) => request.method === method));
  }

  waitForView(viewId, predicate = () => true) {
    return this.waitFor((host) => (host.views.has(viewId) && predicate(host.views.get(viewId)) ? host.views.get(viewId) : undefined));
  }

  waitForLog(match) {
    const test = typeof match === "string" ? (line) => line.includes(match) : (line) => match.test(line);
    return this.waitFor((host) => host.logs.find(test));
  }

  async stop() {
    if (this.exitCode === undefined) {
      this.send("shutdown");
      this.child.stdin.end();
      const timer = setTimeout(() => this.child.kill(), STOP_GRACE_MS);
      await this.exited;
      clearTimeout(timer);
    }
    if (this.ownDataDir) rmSync(this.dataDir, { recursive: true, force: true });
    return this.exitCode;
  }
}

export function startMockHost(dir, options = {}) {
  return new MockHost(dir, options).start(options.command);
}
