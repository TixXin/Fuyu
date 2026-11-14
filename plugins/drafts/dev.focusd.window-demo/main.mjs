import { createPlugin } from "./lib/fuyu.mjs";

const PANEL = "note";
const WIDGET = "clock";
const BOUNDS_KEY = "widgetBounds";
const NOTE_KEY = "lastNote";

const plugin = createPlugin();
let note = "";

const isOpen = async (id) => (await plugin.windows.list()).some((window) => window.id === id);

async function openWidget() {
  const bounds = await plugin.storage.get(BOUNDS_KEY);
  await plugin.windows.create(WIDGET, { kind: "widget", entry: "ui/widget.html", layer: "desktop", ...(bounds ? { bounds } : {}) });
}

async function openPanel() {
  if (await isOpen(PANEL)) {
    await plugin.windows.show(PANEL);
    await plugin.windows.postMessage(PANEL, { type: "clear" });
    return;
  }
  await plugin.windows.create(PANEL, { kind: "panel", entry: "ui/panel.html", hideOnBlur: true, resizable: true });
}

async function toggleWidget() {
  if (await isOpen(WIDGET)) await plugin.windows.close(WIDGET);
  else await openWidget();
}

plugin.onReady(async (context) => {
  if (!(context.experimentalApis ?? []).includes("windows")) {
    plugin.log("The island has no windows API here: load this plugin in development mode on Windows.");
    return;
  }
  note = (await plugin.storage.get(NOTE_KEY)) ?? "";
  await openWidget();
});

plugin.onCommand("note", () => openPanel().catch((error) => plugin.log(`Could not open the panel: ${error.message}`)));
plugin.onCommand("widget", () => toggleWidget().catch((error) => plugin.log(`Could not toggle the widget: ${error.message}`)));

plugin.windows.onMessage(PANEL, async (message) => {
  if (message?.type !== "note" || typeof message.text !== "string" || !message.text.trim()) return;
  note = message.text.trim().slice(0, 200);
  await plugin.storage.set(NOTE_KEY, note);
  if (await isOpen(WIDGET)) await plugin.windows.postMessage(WIDGET, { type: "note", text: note });
  await plugin.windows.hide(PANEL);
});

plugin.windows.onMessage(WIDGET, async (message) => {
  if (message?.type === "ready") await plugin.windows.postMessage(WIDGET, { type: "note", text: note });
});

plugin.windows.onBounds(WIDGET, ({ bounds }) => plugin.storage.set(BOUNDS_KEY, bounds));
plugin.windows.onClosed(WIDGET, (reason) => plugin.log(`The widget closed: ${reason}`));
