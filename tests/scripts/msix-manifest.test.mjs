import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fillManifest, packageFileName, resolveIdentity, sdkVersionsNewestFirst, storeVersion, TEST_IDENTITY } from "../../scripts/msix/manifest.mjs";

test("store versions keep the fourth part at zero and refuse betas unless asked", () => {
  assert.equal(storeVersion("0.3.12"), "0.3.12.0");
  assert.throws(() => storeVersion("0.3.12-beta.1"), /prerelease/);
  assert.equal(storeVersion("0.3.12-beta.1", { allowPrerelease: true }), "0.3.12.0");
  assert.throws(() => storeVersion("1.70000.0"), /65535/);
  assert.throws(() => storeVersion("v1.2"), /Cannot turn/);
});

test("an empty store identity stops the build instead of packing placeholders", () => {
  assert.throws(() => resolveIdentity({ name: "", publisher: "", publisherDisplayName: "" }), /name, publisher, publisherDisplayName/);
  assert.throws(() => resolveIdentity({ name: "A.B", publisher: "E1F3", publisherDisplayName: "X" }), /CN=/);
  assert.deepEqual(resolveIdentity({}, { testIdentity: true }), { ...TEST_IDENTITY });
  const identity = resolveIdentity({ name: " TixXin.Fuyu ", publisher: "CN=ABC", publisherDisplayName: "TixXin" });
  assert.equal(identity.name, "TixXin.Fuyu");
  assert.equal(packageFileName(identity, "1.2.3.0"), "TixXin.Fuyu_1.2.3.0_x64.msix");
});

test("the shipped template fills every placeholder and escapes the publisher", () => {
  const template = readFileSync(new URL("../../src-tauri/msix/AppxManifest.xml.in", import.meta.url), "utf8");
  const filled = fillManifest(template, { name: "TixXin.Fuyu", publisher: 'CN=A & "B"', publisherDisplayName: "<TixXin>" }, "1.2.3.0");
  assert.doesNotMatch(filled, /@[A-Z_]+@/);
  assert.match(filled, /Publisher="CN=A &amp; &quot;B&quot;"/);
  assert.match(filled, /<PublisherDisplayName>&lt;TixXin&gt;<\/PublisherDisplayName>/);
  assert.match(filled, /Version="1\.2\.3\.0"/);
  assert.throws(() => fillManifest("@UNKNOWN@", TEST_IDENTITY, "1.0.0.0"), /Unknown placeholder/);
});

test("the newest SDK is picked by number, not by text", () => {
  assert.deepEqual(sdkVersionsNewestFirst(["10.0.9200.0", "10.0.26100.0", "arm64", "10.0.22621.0"]), ["10.0.26100.0", "10.0.22621.0", "10.0.9200.0"]);
});
