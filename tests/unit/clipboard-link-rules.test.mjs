import test from "node:test";
import assert from "node:assert/strict";
import { itemLink, moveIndex, normalizeClipboardLinks, offeredLink, parseSites, siteMatches } from "../../src/features/clipboard/linkRules.ts";

const base = { hash: "h", createdAt: 1, copiedAt: 1, kind: "text" };
const item = (text) => ({ ...base, id: text, preview: text, text });
const settings = { notice: true, matching: "any", blockedSites: [], onlySites: [] };

test("sites match themselves and their subdomains only", () => {
  assert.ok(siteMatches("www.google.com", "google.com"));
  assert.ok(siteMatches("mail.google.com", "google.com"));
  assert.ok(!siteMatches("notgoogle.com", "google.com"));
});

test("site lists keep bare hosts", () => {
  assert.deepEqual(parseSites("https://www.GitHub.com/x, *.example.org；a.io\n a.io"), ["github.com", "example.org", "a.io"]);
});

test("copied links are offered unless a rule says no", () => {
  assert.equal(offeredLink(item("https://news.example.org/1"), settings)?.hostname, "news.example.org");
  assert.equal(offeredLink(item("example.org/a"), settings)?.hostname, "example.org");
  assert.equal(offeredLink(item("hello"), settings), null);
  assert.equal(offeredLink(item("https://a.com"), { ...settings, notice: false }), null);
  assert.equal(offeredLink(item("example.org/a"), { ...settings, matching: "web" }), null);
  assert.equal(offeredLink(item("https://mail.google.com/x"), { ...settings, blockedSites: ["google.com"] }), null);
  assert.equal(offeredLink(item("https://b.com"), { ...settings, onlySites: ["a.com"] }), null);
  assert.ok(offeredLink(item("https://x.a.com"), { ...settings, onlySites: ["a.com"] }));
  assert.equal(offeredLink({ ...item("https://a.com"), masked: true }, settings), null);
});

test("history links are recognised for the bookmark button", () => {
  assert.equal(itemLink(item("https://a.com/x"))?.href, "https://a.com/x");
  assert.equal(itemLink(item("not a link")), null);
});

test("moving keeps every entry and clamps the target", () => {
  assert.deepEqual(moveIndex(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(moveIndex(["a", "b", "c"], 2, -5), ["c", "a", "b"]);
  assert.deepEqual(moveIndex(["a", "b", "c"], 1, 99), ["a", "c", "b"]);
});

test("broken or old data falls back to defaults", () => {
  assert.deepEqual(normalizeClipboardLinks(null).links, []);
  const links = normalizeClipboardLinks({ settings: { notice: false, matching: "odd", blockedSites: ["a.com", 3] }, links: [{ id: "1", url: "https://a.com/" }, { id: 2 }] });
  assert.deepEqual(links.settings, { notice: false, matching: "any", blockedSites: ["a.com"], onlySites: [] });
  assert.deepEqual(links.links, [{ id: "1", url: "https://a.com/", title: "" }]);
});
