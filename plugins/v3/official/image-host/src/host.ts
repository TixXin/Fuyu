import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context, PluginSetupState } from "@fuyu/plugin-base";
import { clipboardV1, secretsV1 } from "@fuyu/plugin-services";
import {
  ACTION_ID,
  EMPTY_STATE,
  METHODS,
  NO_KEYS,
  SECRET_NAMES,
  TOPICS,
  clipText,
  missingOf,
  normalizeConfig,
  normalizeStored,
  objectKey,
  publicUrl,
  testKey,
  type ErrorInfo,
  type HostConfig,
  type HostState,
  type KeyName,
  type LastUpload,
  type SavedKeys,
} from "./model.ts";
import type { SigningKeys } from "./s3.ts";
import { failureText, textFor } from "./text.ts";
import { errorInfo, failure, putObject, testPicture } from "./upload.ts";

export const name = "@fuyu/image-host";
export const inject = {
  clients: null,
  http: null,
  "screenshot.actions": null,
  "secrets/v1": null,
  "clipboard/v1": { required: false },
  settings: { required: false },
};

type SettingsApi = {
  settings?: {
    setup?: (state: PluginSetupState) => Promise<void> | void;
    open?: () => Promise<void> | void;
  };
};

const CONFIG_FILE = "config.json";
const KEY_NAMES: readonly KeyName[] = ["accessKeyId", "secretAccessKey"];
const SECRETS_FAILED: ErrorInfo = { reason: "secrets", status: 0, code: null };

function quietly(call: () => Promise<void> | void | undefined): void {
  try {
    void Promise.resolve(call()).catch(() => {});
  } catch {
    return;
  }
}

export function apply(ctx: Context) {
  const secrets = ctx.services.get(secretsV1);
  const clipboard = ctx.services.get(clipboardV1);
  const settings = (ctx as unknown as SettingsApi).settings;
  const file = join(ctx.dataDir, CONFIG_FILE);
  const stored = readStored();
  let config: HostConfig = stored.config;
  let last: LastUpload | null = stored.last;
  let keys: SavedKeys = NO_KEYS;
  let busy = false;
  let state: HostState = { ...EMPTY_STATE, config, last };

  function readStored() {
    try {
      return normalizeStored(JSON.parse(readFileSync(file, "utf8")));
    } catch {
      return normalizeStored(null);
    }
  }

  function save() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(file, `${JSON.stringify({ config, last }, null, 2)}\n`, "utf8");
    } catch {}
  }

  function publish(error: ErrorInfo | null = state.error): HostState {
    state = { config, keys, missing: missingOf(config, keys), last, error, busy, at: Date.now() };
    ctx.clients.publish(TOPICS.state, state);
    return state;
  }

  function reportSetup() {
    const needed = missingOf(config, keys).length > 0;
    quietly(() => settings?.setup?.({ needed, hint: { "zh-CN": textFor("zh-CN").setupHint, en: textFor("en").setupHint } }));
  }

  async function loadKeys(error: ErrorInfo | null): Promise<HostState> {
    try {
      const { names } = await secrets.list();
      keys = { accessKeyId: names.includes(SECRET_NAMES.accessKeyId), secretAccessKey: names.includes(SECRET_NAMES.secretAccessKey) };
      reportSetup();
      return publish(error);
    } catch {
      return publish(SECRETS_FAILED);
    }
  }

  async function signingKeys(): Promise<SigningKeys> {
    const [id, secret] = await Promise.all(KEY_NAMES.map((key) => secrets.get({ name: SECRET_NAMES[key] }))).catch(() => {
      throw failure("secrets");
    });
    if (!id.value || !secret.value) throw failure("setup");
    return { accessKeyId: id.value, secretAccessKey: secret.value };
  }

  async function upload(body: Uint8Array, key: string, test: boolean): Promise<string> {
    if (missingOf(config, keys).length > 0) throw failure("setup");
    const signing = await signingKeys();
    await putObject(ctx.http.fetch, { config, keys: signing, key, body, now: new Date() });
    const url = publicUrl(config, key);
    last = { url, at: Date.now(), test };
    save();
    return url;
  }

  async function copy(url: string): Promise<boolean> {
    try {
      await clipboard.copyText({ text: clipText(config.copyAs, url) });
      return true;
    } catch {
      return false;
    }
  }

  async function uploadScreenshot(path: string, locale: "zh-CN" | "en") {
    const text = textFor(locale);
    if (missingOf(config, keys).includes("keys")) await loadKeys(state.error);
    if (missingOf(config, keys).length > 0) {
      quietly(() => settings?.open?.());
      return { message: text.notReady, dismiss: false };
    }
    let body: Uint8Array;
    try {
      body = readFileSync(path);
    } catch {
      return { message: text.failedFile, dismiss: false };
    }
    try {
      const url = await upload(body, objectKey(config.prefix, new Date(), randomBytes(3).toString("hex")), false);
      publish(null);
      return { message: (await copy(url)) ? text.copied : `${text.uploaded} ${url}`, dismiss: false };
    } catch (error) {
      const info = errorInfo(error);
      publish(info);
      return { message: failureText(info, text), dismiss: false };
    }
  }

  async function uploadTest(): Promise<HostState> {
    busy = true;
    publish(null);
    let error: ErrorInfo | null = null;
    try {
      await upload(testPicture(), testKey(config.prefix), true);
    } catch (reason) {
      error = errorInfo(reason);
    }
    busy = false;
    return publish(error);
  }

  async function saveKeys(params: unknown): Promise<HostState> {
    const values = typeof params === "object" && params !== null ? (params as Partial<Record<KeyName, unknown>>) : {};
    try {
      for (const key of KEY_NAMES) {
        const value = typeof values[key] === "string" ? values[key].trim() : "";
        if (value) await secrets.set({ name: SECRET_NAMES[key], value });
      }
    } catch {
      return loadKeys(SECRETS_FAILED);
    }
    return loadKeys(null);
  }

  async function clearKeys(): Promise<HostState> {
    try {
      for (const key of KEY_NAMES) await secrets.remove({ name: SECRET_NAMES[key] });
    } catch {
      return loadKeys(SECRETS_FAILED);
    }
    return loadKeys(null);
  }

  ctx.clients.handle(METHODS.state, () => loadKeys(state.error?.reason === "secrets" ? null : state.error));
  ctx.clients.handle(METHODS.setConfig, (params?: unknown) => {
    config = normalizeConfig(params, config);
    save();
    reportSetup();
    return publish(null);
  });
  ctx.clients.handle(METHODS.saveKeys, (params?: unknown) => saveKeys(params));
  ctx.clients.handle(METHODS.clearKeys, () => clearKeys());
  ctx.clients.handle(METHODS.test, () => uploadTest());

  ctx.screenshotActions.register({
    id: ACTION_ID,
    label: { "zh-CN": textFor("zh-CN").actionLabel, en: textFor("en").actionLabel },
    icon: "share",
    run: ({ path, locale }) => uploadScreenshot(path, locale),
  });

  void loadKeys(null);
}
