import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CLIPBOARD_PRIVACY, normalizeClipboardPrivacy } from "../../src/features/clipboard/privacySettings.ts";

test("missing privacy settings fall back to forgetting cleared entries and a 1 MB cap", () => {
  assert.deepEqual(normalizeClipboardPrivacy({}), DEFAULT_CLIPBOARD_PRIVACY);
  assert.deepEqual(DEFAULT_CLIPBOARD_PRIVACY, { forgetCleared: true, secretExpiryMinutes: 0, maxTextKb: 1024 });
});

test("only the offered choices are kept", () => {
  assert.deepEqual(normalizeClipboardPrivacy({ forgetCleared: false, secretExpiryMinutes: 60, maxTextKb: 0 }), { forgetCleared: false, secretExpiryMinutes: 60, maxTextKb: 0 });
  assert.deepEqual(normalizeClipboardPrivacy({ secretExpiryMinutes: 45, maxTextKb: 3000 }), DEFAULT_CLIPBOARD_PRIVACY);
});
