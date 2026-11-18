import assert from "node:assert/strict";
import test from "node:test";
import { createEngineRegistry } from "../../src/features/translation/host/engines.mjs";
import { isLoopbackCustomBaseUrl, registerTranslationEngine } from "../../src/features/translation/providers.ts";
import { DEFAULT_SETTINGS, normalizeTranslationSettings } from "../../src/features/translation/storage.ts";
import { requestTranslationHandoffOpen, saveTranslationHandoff, takeTranslationHandoff } from "../../src/lib/translation-handoff/storage.ts";

test("settings saved before providers existed keep DeepSeek and their shortcut and direction", () => {
  assert.deepEqual(normalizeTranslationSettings({ shortcut: "Ctrl+Q", direction: "en-zh" }), {
    shortcut: "Ctrl+Q",
    direction: "en-zh",
    provider: "deepseek",
    customBaseUrl: "",
    models: {},
    selectionShortcut: "Ctrl+Alt+T",
    pasteClipboardOnOpen: true,
    autoTranslate: false,
  });
  assert.deepEqual(normalizeTranslationSettings(null), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.provider, "siliconflow");
  assert.equal(normalizeTranslationSettings({ shortcut: "Alt+Space" }).shortcut, "Ctrl+Shift+F");
  assert.equal(normalizeTranslationSettings({ shortcut: "Alt+C" }).shortcut, "Ctrl+Shift+F");
});

test("provider, custom base URL and per-provider models are kept when valid", () => {
  const settings = normalizeTranslationSettings({
    provider: "custom",
    customBaseUrl: "http://localhost:11434/v1",
    models: { custom: "qwen3:8b", volcengine: "ep-123", baidu: "x", openai: 4 },
  });
  assert.equal(settings.provider, "custom");
  assert.equal(settings.customBaseUrl, "http://localhost:11434/v1");
  assert.deepEqual(settings.models, { custom: "qwen3:8b", volcengine: "ep-123" });
  assert.equal(normalizeTranslationSettings({ provider: "baidu" }).provider, "deepseek");
  assert.equal(normalizeTranslationSettings({ provider: "siliconflow" }).provider, "siliconflow");
  assert.deepEqual(normalizeTranslationSettings({ models: "x" }).models, {});
});

test("clipboard fill stays on, auto-translate stays off unless switched, and empty shortcuts stay off while missing ones get defaults", () => {
  const settings = normalizeTranslationSettings({ pasteClipboardOnOpen: false, autoTranslate: true, shortcut: "", selectionShortcut: "" });
  assert.equal(settings.pasteClipboardOnOpen, false);
  assert.equal(settings.autoTranslate, true);
  assert.equal(settings.shortcut, "");
  assert.equal(settings.selectionShortcut, "");
  assert.equal(normalizeTranslationSettings({ shortcut: "   ", selectionShortcut: "  " }).shortcut, "");
  assert.equal(normalizeTranslationSettings({ shortcut: "   ", selectionShortcut: "  " }).selectionShortcut, "");
  assert.equal(normalizeTranslationSettings({}).shortcut, "Ctrl+Shift+F");
  assert.equal(normalizeTranslationSettings({}).selectionShortcut, "Ctrl+Alt+T");
  assert.equal(normalizeTranslationSettings({ shortcut: null, selectionShortcut: 123 }).shortcut, "Ctrl+Shift+F");
  assert.equal(normalizeTranslationSettings({ shortcut: null, selectionShortcut: 123 }).selectionShortcut, "Ctrl+Alt+T");
  assert.equal(normalizeTranslationSettings({ autoTranslate: "yes" }).autoTranslate, false);
});

test("loopback custom base URLs allow keyless translation while remote or malformed URLs still require a key", () => {
  assert.equal(isLoopbackCustomBaseUrl("http://localhost:11434/v1"), true);
  assert.equal(isLoopbackCustomBaseUrl("http://127.0.0.1:8080"), true);
  assert.equal(isLoopbackCustomBaseUrl("http://[::1]:11434/v1"), true);
  assert.equal(isLoopbackCustomBaseUrl("https://localhost:8443/v1"), true);
  assert.equal(isLoopbackCustomBaseUrl("https://api.example.com/v1"), false);
  assert.equal(isLoopbackCustomBaseUrl("http://192.168.1.5:11434/v1"), false);
  assert.equal(isLoopbackCustomBaseUrl("http://user:pass@localhost:11434/v1"), false);
  assert.equal(isLoopbackCustomBaseUrl("http://localhost:11434/v1?key=1"), false);
  assert.equal(isLoopbackCustomBaseUrl(""), false);
  assert.equal(isLoopbackCustomBaseUrl("localhost:11434"), false);
});

test("the window takes a quick result only right after the island asked to open it", () => {
  const values = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) },
  });
  try {
    saveTranslationHandoff("hello", "你好");
    assert.equal(takeTranslationHandoff(), null, "an ordinary open stays blank");
    requestTranslationHandoffOpen();
    const now = Date.now();
    assert.equal(takeTranslationHandoff(now + 6_000), null, "a stale open request is ignored");
    requestTranslationHandoffOpen();
    assert.deepEqual(takeTranslationHandoff(), { source: "hello", output: "你好" });
    assert.equal(takeTranslationHandoff(), null, "it is consumed once");
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});

test("registered custom translation engines are accepted by settings normalization and cleaned up on dispose", async () => {
  assert.equal(normalizeTranslationSettings({ provider: "ollama" }).provider, "deepseek");
  const dispose = registerTranslationEngine({
    engine: "ollama",
    label: { "zh-CN": "本地 Ollama", en: "Local Ollama" },
    defaultModel: "qwen3:8b",
    translate: ({ text, direction, model }) => `[${direction}:${model}] ${text}`,
  });
  try {
    const normalized = normalizeTranslationSettings({ provider: "ollama", models: { ollama: "llama3.3" } });
    assert.equal(normalized.provider, "ollama");
    assert.deepEqual(normalized.models, { ollama: "llama3.3" });
  } finally {
    dispose();
  }
  assert.equal(normalizeTranslationSettings({ provider: "ollama" }).provider, "deepseek");

  const registry = createEngineRegistry();
  let notified = 0;
  registry.subscribe(() => {
    notified += 1;
  });
  const off = registry.register({
    engine: "local-llm",
    hasSecret: () => true,
    translate: ({ text }) => ({ text: text.toUpperCase() }),
  });
  assert.equal(notified, 1);
  assert.deepEqual(await registry.get("local-llm").translate({ text: "hello" }), { text: "HELLO", engine: "local-llm" });
  assert.equal(registry.get("local-llm").rewrite, null);
  off();
  assert.equal(notified, 2);
  assert.equal(registry.get("local-llm"), null);
});
