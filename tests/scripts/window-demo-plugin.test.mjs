import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { startMockHost } from "../../packages/fuyu-plugin/src/test/index.mjs";

const PLUGIN = path.resolve("plugins/drafts/dev.focusd.window-demo");
const BOUNDS = { x: 40, y: 60, width: 260, height: 150 };

test("the window demo puts a widget on the desktop where it was and writes notes from a panel", async () => {
  const host = startMockHost(PLUGIN, { storage: { widgetBounds: BOUNDS, lastNote: "old" } });
  try {
    const widget = await host.waitFor((state) => state.windows.get("clock"));
    assert.deepEqual([widget.kind, widget.layer, widget.entry], ["widget", "desktop", "ui/widget.html"]);
    assert.deepEqual(widget.bounds, BOUNDS);

    host.windowMessage("clock", { type: "ready" });
    await host.waitFor((state) => state.windows.get("clock").messages.length === 1);
    assert.deepEqual(host.windows.get("clock").messages[0], { type: "note", text: "old" });

    host.command("note");
    const panel = await host.waitFor((state) => state.windows.get("note"));
    assert.deepEqual([panel.kind, panel.visible, panel.hideOnBlur], ["panel", true, true]);

    host.windowMessage("note", { type: "note", text: "  buy milk  " });
    await host.waitFor((state) => state.windows.get("note").visible === false);
    assert.equal(host.storage.get("lastNote"), "buy milk");
    assert.deepEqual(host.windows.get("clock").messages.at(-1), { type: "note", text: "buy milk" });

    const moved = { x: 500, y: 300, width: 260, height: 150 };
    host.windowEvent("window.bounds", { id: "clock", bounds: moved, screen: "\\.\DISPLAY1" });
    await host.waitFor((state) => state.storage.get("widgetBounds")?.x === 500);

    host.command("widget");
    await host.waitFor((state) => !state.windows.has("clock"));
  } finally {
    await host.stop();
  }
});
