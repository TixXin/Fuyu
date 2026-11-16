import assert from "node:assert/strict";
import { test } from "node:test";
import * as services from "@fuyu/plugin-services";

const definitions = Object.values(services).filter((value) => services.isServiceDefinition(value));

test("SERVICES names every built-in service the package defines, with its version", () => {
  assert.deepEqual([...services.SERVICES].sort(), definitions.map((definition) => definition.name).sort());
  assert.ok(services.SERVICES.includes("timers/v1"));
  assert.ok(services.SERVICES.includes("translator/v1"));
  assert.ok(services.SERVICES.includes("reminders/v1"));
  assert.ok(services.SERVICES.includes("calendar/v1"));
  assert.ok(services.SERVICES.includes("file-shelf/v1"));
  assert.ok(services.SERVICES.includes("media/v1"));
  for (const name of services.SERVICES) assert.match(name, services.SERVICE_NAME);
  assert.ok(Object.isFrozen(services.SERVICES));
});
