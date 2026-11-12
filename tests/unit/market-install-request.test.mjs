import assert from "node:assert/strict";
import test from "node:test";
import { marketRequestState } from "../../src/features/plugins/market-link/requestState.ts";

const market = { plugins: [{ id: "dev.focusd.pomodoro" }, { id: "com.example.clock" }] };

test("a requested plugin in the market is found", () => {
  assert.deepEqual(marketRequestState("com.example.clock", market, false, null), { kind: "found", plugin: { id: "com.example.clock" } });
  assert.equal(marketRequestState("com.example.clock", market, true, null).kind, "found");
});

test("the request waits while the market loads, and says when the plugin isn't listed", () => {
  assert.equal(marketRequestState("x.y.z", null, true, null).kind, "loading");
  assert.equal(marketRequestState("x.y.z", null, false, null).kind, "loading");
  assert.equal(marketRequestState("x.y.z", market, true, null).kind, "loading");
  assert.equal(marketRequestState("x.y.z", market, false, null).kind, "missing");
});

test("a market that could not be read is reported once loading stops", () => {
  assert.equal(marketRequestState("x.y.z", null, false, "offline").kind, "failed");
  assert.equal(marketRequestState("x.y.z", null, true, "offline").kind, "loading");
});
