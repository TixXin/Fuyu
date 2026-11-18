import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyImSnapshots,
  firstPendingImSource,
  IM_SOURCE_IDS,
  imSourceBadge,
  imUnreadTotal,
  nextImPreviewState,
  sortImSourcesForSettings,
} from "../../src/features/messages/im-sources/imSourcesState.ts";
import { resolveMessageSource } from "../../src/features/messages/island/messageSource.ts";
import { hasUnreadMessages } from "../../src/features/messages/island/tuckHold.ts";

test("settings sort installed IM apps first while keeping canonical order within each group", () => {
  const snapshots = createEmptyImSnapshots();
  snapshots.feishu.installed = true;
  snapshots.whatsapp.installed = true;

  assert.deepEqual(
    sortImSourcesForSettings(snapshots, { isMacOS: false }),
    ["whatsapp", "feishu", "telegram", "discord", "tim", "dingtalk", "wecom"],
  );
});

test("macOS hides TIM when neither installed nor enabled, and shows it if installed or enabled", () => {
  const snapshots = createEmptyImSnapshots();
  snapshots.telegram.installed = true;

  assert.deepEqual(
    sortImSourcesForSettings(snapshots, { isMacOS: true }),
    ["telegram", "discord", "whatsapp", "feishu", "dingtalk", "wecom"],
  );

  snapshots.tim.installed = true;
  assert.deepEqual(
    sortImSourcesForSettings(snapshots, { isMacOS: true }),
    ["telegram", "tim", "discord", "whatsapp", "feishu", "dingtalk", "wecom"],
  );

  snapshots.tim.installed = false;
  snapshots.tim.enabled = true;
  assert.equal(sortImSourcesForSettings(snapshots, { isMacOS: true }).includes("tim"), true);
});

test("nextImPreviewState merges a 2-second flash-to-toast replacement in place and clears when hidden", () => {
  const flash = nextImPreviewState(
    null,
    null,
    { newestId: "telegram:flash:1000", windowVisible: true, snapshot: { enabled: true } },
    true,
    1000,
  );
  assert.deepEqual(flash.previewWindow, {
    id: "telegram:flash:1000",
    replacedId: null,
    expiresAt: 6000,
    receivedAt: 1000,
  });

  const upgraded = nextImPreviewState(
    flash.previewWindow,
    flash.timing,
    {
      newestId: "telegram:toast:8:1",
      replacedId: "telegram:flash:1000",
      windowVisible: true,
      snapshot: { enabled: true },
    },
    true,
    1400,
  );
  assert.deepEqual(upgraded.previewWindow, {
    id: "telegram:toast:8:1",
    replacedId: "telegram:flash:1000",
    expiresAt: 6400,
    receivedAt: 1400,
  });
  assert.equal(upgraded.timing?.burstStartedAt, 1000);

  const hidden = nextImPreviewState(
    upgraded.previewWindow,
    upgraded.timing,
    { newestId: "telegram:toast:9:1", windowVisible: false, snapshot: { enabled: true } },
    true,
    2000,
  );
  assert.equal(hidden.previewWindow, null);
  assert.equal(hidden.timing, null);
});

test("imSourceBadge, imUnreadTotal, resolveMessageSource and hasUnreadMessages cover toast, flash and badge items", () => {
  const snapshots = createEmptyImSnapshots();
  snapshots.telegram.enabled = true;
  snapshots.telegram.items = [{ id: "telegram:flash:1", kind: "flash", title: "Telegram", body: "", createdAt: 10 }];
  snapshots.discord.enabled = true;
  snapshots.discord.items = [
    { id: "discord:toast:1:1", kind: "toast", title: "Bob", body: "Hi", createdAt: 20 },
    { id: "discord:toast:2:1", kind: "toast", title: "Bob", body: "Ping", createdAt: 30 },
  ];
  snapshots.feishu.enabled = true;
  snapshots.feishu.items = [{ id: "feishu:badge:40", kind: "badge", title: "Feishu", body: "", createdAt: 40, unread: 5 }];

  assert.deepEqual(imSourceBadge(snapshots.telegram), { count: 0, dot: true });
  assert.deepEqual(imSourceBadge(snapshots.discord), { count: 2, dot: false });
  assert.deepEqual(imSourceBadge(snapshots.feishu), { count: 5, dot: false });
  assert.equal(imUnreadTotal(snapshots), 8);
  assert.equal(firstPendingImSource(snapshots), "telegram");

  assert.equal(resolveMessageSource("qq", { qq: false, wechat: false, qqMail: false, feishu: true }), "feishu");
  assert.equal(
    hasUnreadMessages({
      qq: { enabled: false, count: 0 },
      wechat: { enabled: false, pending: false },
      mail: { enabled: false, newUnread: false },
      im: { unread: imUnreadTotal(snapshots) },
    }),
    true,
  );
  assert.equal(IM_SOURCE_IDS.length, 7);
});
