import assert from "node:assert/strict";
import { test } from "node:test";
import { packageIconUrl } from "../../src/features/plugin-kernel/packageIconUrl.ts";

const BASE = "fuyu-plugin://localhost";

test("an installed package's icon is addressed under its own folder", () => {
  assert.equal(packageIconUrl(BASE, "@fuyu/alarm", "assets/icon.svg"), "fuyu-plugin://localhost/packages/@fuyu/alarm/assets/icon.svg");
  assert.equal(packageIconUrl(BASE, "@Some/pkg", "img/my icon.png"), "fuyu-plugin://localhost/packages/@some/pkg/img/my%20icon.png");
});

test("a built-in plugin or a package without an icon has no icon address", () => {
  assert.equal(packageIconUrl(BASE, "timer", "assets/icon.svg"), null);
  assert.equal(packageIconUrl(BASE, "@fuyu/alarm", null), null);
  assert.equal(packageIconUrl(BASE, "@fuyu/alarm", ""), null);
});
