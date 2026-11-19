import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  COMMUNITY_SOURCES,
  groupsFor,
  isExpired,
  loadCommunityList,
  parseCommunityList,
} from "../../src/features/updater/community/communityGroups.ts";

const wechat = { id: "wechat", platform: "wechat", name: { "zh-CN": "用户群", en: "Users" }, qr: "wechat-group.png", expiresAt: "2026-11-25" };

test("the community list in the repo parses and every QR image it names exists", () => {
  const dir = new URL("../../docs/assets/community/", import.meta.url);
  const groups = parseCommunityList(JSON.parse(readFileSync(new URL("community.json", dir), "utf8")));
  assert.ok(groups && groups.length > 0);
  for (const group of groups) if (group.qr) assert.ok(existsSync(new URL(group.qr, dir)), group.qr);
});

test("a QR code stays valid through its expiry day and is expired the next morning", () => {
  const [group] = parseCommunityList({ version: 1, groups: [wechat] });
  assert.equal(isExpired(group, new Date(2026, 10, 25, 23, 59)), false);
  assert.equal(isExpired(group, new Date(2026, 10, 26, 0, 0)), true);
});

test("entries that cannot be shown safely are dropped instead of breaking the list", () => {
  const groups = parseCommunityList({
    version: 1,
    groups: [
      wechat,
      { ...wechat, id: "escape", qr: "../../secret.png" },
      { ...wechat, id: "http", qr: undefined, link: "http://example.com/join" },
      { ...wechat, id: "script", qr: undefined, link: "javascript:alert(1)" },
      { id: "nameless", platform: "qq", number: "123456" },
      "junk",
    ],
  });
  assert.deepEqual(groups.map((group) => group.id), ["wechat"]);
  assert.equal(parseCommunityList({ version: 2, groups: [wechat] }), null);
});

test("a platform the app does not know yet still shows as other", () => {
  const [group] = parseCommunityList({ version: 1, groups: [{ ...wechat, platform: "line" }] });
  assert.equal(group.platform, "other");
});

test("groups limited to one language only show in that language", () => {
  const groups = parseCommunityList({ version: 1, groups: [wechat, { ...wechat, id: "discord", platform: "discord", locales: ["en"], qr: undefined, link: "https://discord.gg/x" }] });
  assert.deepEqual(groupsFor(groups, "zh-CN").map((group) => group.id), ["wechat"]);
  assert.deepEqual(groupsFor(groups, "en").map((group) => group.id), ["wechat", "discord"]);
});

test("when GitHub cannot be reached the list comes from the next mirror, and images use that mirror", async () => {
  const asked = [];
  const list = await loadCommunityList(async (url) => {
    asked.push(url);
    if (!url.startsWith("https://ghfast.top/")) throw new Error("offline");
    return { ok: true, json: async () => ({ version: 1, groups: [wechat] }) };
  });
  assert.equal(list.source.name, "ghfast.top");
  assert.equal(asked.length, 2);
  assert.ok(asked[0].startsWith("https://raw.githubusercontent.com/TixXin/fuyu/main/"));
});

test("when every source fails the list is null", async () => {
  const list = await loadCommunityList(async () => ({ ok: false, json: async () => null }));
  assert.equal(list, null);
  assert.equal(COMMUNITY_SOURCES.length, 3);
});
