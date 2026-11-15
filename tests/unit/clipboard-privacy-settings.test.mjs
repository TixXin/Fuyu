import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CLIPBOARD_PRIVACY, normalizeClipboardPrivacy } from "../../src/features/clipboard/privacySettings.ts";

test("missing privacy settings fall back to forgetting cleared entries and a 1 MB cap", () => {
  assert.deepEqual(normalizeClipboardPrivacy({}), DEFAULT_CLIPBOARD_PRIVACY);
  assert.deepEqual(DEFAULT_CLIPBOARD_PRIVACY, { forgetCleared: true, secretExpiryMinutes: 0, maxTextKb: 1024, recordRemote: true });
});

test("only the offered choices are kept", () => {
  assert.deepEqual(normalizeClipboardPrivacy({ forgetCleared: false, secretExpiryMinutes: 60, maxTextKb: 0, recordRemote: false }), { forgetCleared: false, secretExpiryMinutes: 60, maxTextKb: 0, recordRemote: false });
  assert.deepEqual(normalizeClipboardPrivacy({ secretExpiryMinutes: 45, maxTextKb: 3000 }), DEFAULT_CLIPBOARD_PRIVACY);
});

test("entries from other devices are named by the given label instead of a program", async () => {
  const { OTHER_DEVICE_SOURCE, sourceName } = await import("../../src/features/clipboard/fileEntry.ts");
  const remote = { kind: "text", source: { path: OTHER_DEVICE_SOURCE, name: "Other device" } };
  assert.equal(sourceName(remote, "Fuyu", "Screenshot", "其他设备"), "其他设备");
  assert.equal(sourceName(remote, "Fuyu"), "Other device");
  assert.equal(sourceName({ kind: "text", source: { path: "/Applications/Notes.app", name: "Notes" } }, "Fuyu", "Screenshot", "其他设备"), "Notes");
});
