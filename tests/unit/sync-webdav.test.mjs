import assert from "node:assert/strict";
import test from "node:test";
import { activeSyncBackend, DEFAULT_SYNC_STATUS, isSyncActive } from "../../src/features/sync/syncState.ts";
import {
  canReuseSavedWebdavPassword,
  canSubmitWebdavForm,
  normalizeDraftWebdavUrl,
} from "../../src/features/sync/webdavForm.ts";
import { SYNC_BACKENDS } from "../../src/features/sync/syncBackends.ts";
import { en, zhCN } from "../../src/i18n/sections/sync.ts";

test("sync backends list includes both folder and webdav with localized labels", () => {
  assert.deepEqual(
    SYNC_BACKENDS.map((entry) => entry.id),
    ["folder", "webdav"],
  );
  assert.equal(zhCN.backend.methods.webdav, "WebDAV");
  assert.equal(en.backend.methods.webdav, "WebDAV");
});

test("saved WebDAV password can be reused only when URL and username still match", () => {
  const saved = {
    url: "https://dav.jianguoyun.com/dav/我的坚果云/",
    username: "alice@example.com",
    hasPassword: true,
  };

  assert.equal(normalizeDraftWebdavUrl(" https://dav.jianguoyun.com/dav/我的坚果云 "), "https://dav.jianguoyun.com/dav/我的坚果云/");
  assert.equal(canReuseSavedWebdavPassword(saved, "https://dav.jianguoyun.com/dav/我的坚果云", "alice@example.com"), true);
  assert.equal(canSubmitWebdavForm(saved, "https://dav.jianguoyun.com/dav/我的坚果云", "alice@example.com", ""), true);

  assert.equal(canReuseSavedWebdavPassword(saved, "https://evil.example.com/dav/", "alice@example.com"), false);
  assert.equal(canSubmitWebdavForm(saved, "https://evil.example.com/dav/", "alice@example.com", ""), false);
  assert.equal(canSubmitWebdavForm(saved, "https://evil.example.com/dav/", "alice@example.com", "new-app-pass"), true);

  assert.equal(canReuseSavedWebdavPassword(saved, "https://dav.jianguoyun.com/dav/我的坚果云/", "bob@example.com"), false);
  assert.equal(canReuseSavedWebdavPassword({ ...saved, hasPassword: false }, saved.url, saved.username), false);
});

test("activeSyncBackend resolves explicit backend and legacy folder payloads", () => {
  assert.equal(activeSyncBackend(DEFAULT_SYNC_STATUS), "off");
  assert.equal(isSyncActive(DEFAULT_SYNC_STATUS), false);

  const legacyFolder = { ...DEFAULT_SYNC_STATUS, backend: undefined, folder: "/Users/demo/Sync", phase: "idle" };
  assert.equal(activeSyncBackend(legacyFolder), "folder");
  assert.equal(isSyncActive(legacyFolder), true);

  const webdavActive = {
    ...DEFAULT_SYNC_STATUS,
    backend: "webdav",
    phase: "idle",
    webdav: { url: "https://cloud.example.com/remote.php/dav/files/alice/Fuyu/", username: "alice", hasPassword: true },
  };
  assert.equal(activeSyncBackend(webdavActive), "webdav");
  assert.equal(isSyncActive(webdavActive), true);
});

test("setup guides document Nutstore app password, Nextcloud and Synology WebDAV in both locales", () => {
  for (const key of ["nutstoreWebdav", "nextcloudWebdav", "synologyWebdav"]) {
    assert.ok(zhCN.help.items[key].title.length > 0, key);
    assert.ok(zhCN.help.items[key].description.length > 0, key);
    assert.ok(en.help.items[key].title.length > 0, key);
    assert.ok(en.help.items[key].description.length > 0, key);
  }
  assert.ok(zhCN.help.items.nutstoreWebdav.description.includes("第三方应用管理"));
  assert.ok(zhCN.help.items.nextcloudWebdav.description.includes("remote.php/dav/files"));
  assert.ok(zhCN.help.items.synologyWebdav.description.includes("5006"));
});
