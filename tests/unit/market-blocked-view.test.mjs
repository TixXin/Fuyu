import assert from "node:assert/strict";
import { test } from "node:test";
import { blockedView } from "../../src/features/updater/host/marketStore.mjs";

const plugin = (versions) => ({ versions });
const selected = (partial) => ({ install: null, manual: null, autoUpdate: null, skipped: [], ...partial });

test("blockedView stays empty when a version can still be installed or the plugin is already installed", () => {
  assert.equal(blockedView(plugin([]), selected({ install: { version: "1.0.0" }, skipped: [{ version: "0.9.0", reason: "engines" }] }), null), null);
  assert.equal(blockedView(plugin([]), selected({ skipped: [{ version: "1.0.0", reason: "engines" }] }), { version: "1.0.0" }), null);
  assert.equal(blockedView(plugin([]), selected({}), null), null);
});

test("blockedView names the newest Fuyu range when every version needs a newer app", () => {
  const view = blockedView(
    plugin([
      { version: "1.0.0", engines: { fuyu: ">=0.9.0" } },
      { version: "1.2.0", engines: { fuyu: ">=1.0.0" } },
    ]),
    selected({
      skipped: [
        { version: "1.0.0", reason: "engines" },
        { version: "1.2.0", reason: "engines" },
      ],
    }),
    null,
  );
  assert.deepEqual(view, { reason: "engines", range: ">=1.0.0" });
  assert.deepEqual(
    blockedView(plugin([{ version: "1.0.0", engines: {} }]), selected({ skipped: [{ version: "1.0.0", reason: "engines" }] }), null),
    { reason: "engines" },
  );
});

test("blockedView reports the current system only when every version is the wrong platform", () => {
  assert.deepEqual(blockedView(plugin([]), selected({ skipped: [{ version: "1.0.0", reason: "platform" }] }), null), { reason: "platform" });
  assert.equal(
    blockedView(
      plugin([]),
      selected({
        skipped: [
          { version: "1.0.0", reason: "platform" },
          { version: "1.1.0", reason: "engines" },
        ],
      }),
      null,
    ),
    null,
  );
});
