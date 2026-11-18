import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_V2_MIGRATION,
  normalizeV2MigrationSnapshot,
  resolveLegacyPluginTitle,
  shouldShowIslandMigrationNotice,
  shouldShowSettingsMigrationCard,
  totalLegacyPlugins,
} from "../../src/features/plugin-kernel/v2Migration.ts";

test("normalizeV2MigrationSnapshot tolerates null and malformed inputs", () => {
  assert.equal(normalizeV2MigrationSnapshot(null), EMPTY_V2_MIGRATION);
  assert.equal(normalizeV2MigrationSnapshot(undefined), EMPTY_V2_MIGRATION);
  assert.equal(normalizeV2MigrationSnapshot("invalid"), EMPTY_V2_MIGRATION);
  assert.equal(
    normalizeV2MigrationSnapshot({ official: [], other: [], islandPending: true, settingsPending: true }),
    EMPTY_V2_MIGRATION,
  );
});

test("normalizeV2MigrationSnapshot parses official mappings, legacy plugins, and pending flags", () => {
  const snapshot = normalizeV2MigrationSnapshot({
    official: [
      {
        v2Id: "dev.focusd.weather",
        v3Id: "@fuyu/weather",
        title: { "zh-CN": "天气", en: "Weather" },
        enabledInV2: true,
        configMigrated: true,
        installedInV3: false,
        registeredInYml: false,
      },
      {
        v2Id: "",
        v3Id: "@fuyu/pomodoro",
      },
    ],
    other: [
      {
        id: "com.example.custom",
        title: { "zh-CN": "自定义插件", en: "Custom plugin" },
        enabledInV2: true,
      },
    ],
    islandPending: true,
    settingsPending: false,
  });

  assert.equal(snapshot.official.length, 1);
  assert.equal(snapshot.official[0].v2Id, "dev.focusd.weather");
  assert.equal(snapshot.official[0].v3Id, "@fuyu/weather");
  assert.equal(snapshot.official[0].configMigrated, true);
  assert.equal(snapshot.other.length, 1);
  assert.equal(snapshot.other[0].id, "com.example.custom");
  assert.equal(totalLegacyPlugins(snapshot), 2);
  assert.equal(shouldShowIslandMigrationNotice(snapshot), true);
  assert.equal(shouldShowSettingsMigrationCard(snapshot), false);
  assert.equal(resolveLegacyPluginTitle(snapshot.other[0].title, snapshot.other[0].id, "zh-CN"), "自定义插件");
  assert.equal(resolveLegacyPluginTitle(snapshot.other[0].title, snapshot.other[0].id, "en"), "Custom plugin");
  assert.equal(resolveLegacyPluginTitle(null, "com.example.custom", "en"), "com.example.custom");
});
