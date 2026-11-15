import assert from "node:assert/strict";
import test from "node:test";
import { childrenAlert, nestSessions } from "../../src/features/agent-status/sessionChildren.ts";

const session = (sessionId, parentId, extra = {}) => ({
  provider: "claudeCode", sessionId, parentId, phase: "running", updatedAt: 1, replyMarker: null, replyAsks: false, backgroundTasks: 0, ...extra,
});
const ids = (list) => list.map((entry) => (entry.session ?? entry).sessionId);

test("child sessions hang under the root, grandchildren follow their parent", () => {
  const list = [session("c1", "p"), session("p"), session("g", "c1"), session("c2", "p"), session("solo")];
  const { roots, children } = nestSessions(list);
  assert.deepEqual(ids(roots), ["p", "solo"]);
  assert.deepEqual(ids(children.get("claudeCode:p")), ["c1", "g", "c2"]);
  assert.deepEqual(children.get("claudeCode:p").map((child) => child.depth), [1, 2, 1]);
  assert.equal(children.has("claudeCode:solo"), false);
});

test("children stay on their own when the parent is not listed, remote, another agent, or a loop", () => {
  const { roots, children } = nestSessions([
    session("orphan", "gone"),
    session("self", "self"),
    session("a", "b"),
    session("b", "a"),
    session("r", "p2"),
    session("p2", undefined, { remoteHost: "srv" }),
    session("x", "y", { provider: "codex" }),
    session("y", undefined, { provider: "codex" }),
  ]);
  assert.deepEqual(ids(roots), ["orphan", "self", "a", "b", "r", "p2", "x", "y"]);
  assert.equal(children.size, 0);
});

test("a collapsed parent shows the most urgent child that needs you", () => {
  const children = [
    { session: session("w", "p"), depth: 1 },
    { session: session("t", "p", { phase: "completed", replyAsks: true }), depth: 1 },
    { session: session("n", "p", { phase: "waiting" }), depth: 2 },
  ];
  assert.deepEqual(childrenAlert(children), { light: "needs", count: 2 });
  assert.deepEqual(childrenAlert(children.slice(0, 2)), { light: "yourTurn", count: 1 });
  assert.equal(childrenAlert(children.slice(0, 1)), null);
  const done = [{ session: session("d", "p", { phase: "completed" }), depth: 1 }];
  assert.equal(childrenAlert(done), null);
  assert.deepEqual(childrenAlert(done, new Set(["claudeCode:d"])), { light: "done", count: 1 });
});
