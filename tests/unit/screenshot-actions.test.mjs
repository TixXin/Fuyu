import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { createScreenshotActionRegistry, registerScreenshotAction, screenshotActions } from "../../src/features/screenshot/host/actions.mjs";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));
const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

test("screenshot action registry orders actions, runs them with screenshot context, and cleans up on dispose", async () => {
  const registry = createScreenshotActionRegistry();
  let notified = 0;
  registry.subscribe(() => {
    notified += 1;
  });
  let enabled = false;
  const offSecond = registry.register({
    id: "upload-image",
    order: 20,
    icon: "share",
    label: { "zh-CN": "上传图床", en: "Upload Image" },
    disabledTitle: { "zh-CN": "未配置图床", en: "No host configured" },
    disabled: () => !enabled,
    run: ({ path, saved }) => ({ message: `uploaded:${path}:${saved}`, dismiss: true }),
  });
  const offFirst = registry.register({
    id: "append-note",
    order: 10,
    icon: "wand",
    label: "贴入笔记",
    run: ({ path }) => `noted:${path}`,
  });
  assert.throws(
    () => registry.register({ id: "append-note", label: "Dup", run: () => {} }),
    { code: "conflict" },
  );
  assert.equal(notified, 2);
  assert.deepEqual(
    registry.list().map((item) => [item.id, item.order, item.disabled, item.label.en]),
    [
      ["append-note", 10, false, "贴入笔记"],
      ["upload-image", 20, true, "Upload Image"],
    ],
  );
  await assert.rejects(registry.run("upload-image", { path: "/tmp/a.png" }), { code: "disabled" });
  enabled = true;
  assert.equal(registry.list()[1].disabled, false);
  assert.deepEqual(await registry.run("append-note", { path: "/tmp/a.png", saved: false }), {
    message: "noted:/tmp/a.png",
    dismiss: false,
  });
  assert.deepEqual(await registry.run("upload-image", { path: "/tmp/a.png", saved: true }), {
    message: "uploaded:/tmp/a.png:true",
    dismiss: true,
  });
  offFirst();
  offSecond();
  assert.deepEqual(registry.list(), []);

  const disposeShared = registerScreenshotAction({
    id: "shared-action",
    label: { "zh-CN": "共享动作", en: "Shared Action" },
    run: () => {},
  });
  assert.equal(screenshotActions.has("shared-action"), true);
  disposeShared();
  assert.equal(screenshotActions.has("shared-action"), false);
});

test("a host plugin registers a post-screenshot action on screenshot.actions and stopping the plugin withdraws it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "screenshot-actions-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const host = await startHost({ dir, builtins: BUILTINS });
  cleanup.push(() => host.stop());
  await host.settle();

  let actionsService;
  const fiber = await host.ctx.plugin({
    name: "shot-uploader",
    inject: ["screenshot.actions"],
    apply(ctx) {
      actionsService = ctx.screenshotActions;
      ctx.screenshotActions.register({
        id: "ocr-table",
        order: 15,
        label: { "zh-CN": "提取表格", en: "Extract Table" },
        run: ({ path }) => ({ message: `table:${path}`, dismiss: false }),
      });
    },
  });
  assert.deepEqual(
    actionsService.list().map((item) => item.id),
    ["ocr-table"],
  );
  assert.deepEqual(await actionsService.run("ocr-table", { path: "/tmp/shot.png" }), {
    message: "table:/tmp/shot.png",
    dismiss: false,
  });
  await fiber.dispose();
  assert.deepEqual(actionsService.list(), []);
});
