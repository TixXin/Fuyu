import assert from "node:assert/strict";
import test from "node:test";
import { aggregateContributions, LINE_PRIORITY } from "../../src/features/plugin-kernel/islandContributions.ts";
import { agentLineContribution, pickAgentSession } from "../../src/features/agent-status/plugin/agentLine.ts";

const named = { provider: "claude", label: "Claude Code", title: "Write the report" };
const interjection = { provider: "codex", label: "Codex", title: "Needs your answer" };

const line = (item, priority, extra = {}) => ({ kind: "line", item, priority, ...extra });
const lyrics = (priority) => line("media.lyric", priority, { shareable: true, lead: true, page: "music" });
const sorted = (...items) => aggregateContributions([items], true).lines;

test("with nothing else on the bar the agent line follows the title mode", () => {
  assert.equal(pickAgentSession([], "running", named, interjection), named);
  assert.equal(pickAgentSession([], "changes", named, interjection), interjection);
});

test("lyrics put first push the agent down to interjections only", () => {
  assert.equal(pickAgentSession(sorted(lyrics(LINE_PRIORITY.lyricsFirst)), "running", named, interjection), interjection);
  assert.equal(pickAgentSession(sorted(lyrics(LINE_PRIORITY.lyricsFirst)), "running", named, null), null);
});

test("lyrics below the agent title leave the named session in place", () => {
  assert.equal(pickAgentSession(sorted(lyrics(LINE_PRIORITY.lyrics)), "running", named, interjection), named);
});

test("lines that cannot share the bar or sit above an interjection do not change the pick", () => {
  const lines = sorted(line("calendar.meeting", LINE_PRIORITY.meeting, { shareable: true }), line("todos.title", LINE_PRIORITY.todoTitle));
  assert.equal(pickAgentSession(lines, "running", named, interjection), named);
  assert.equal(pickAgentSession(sorted(line("other", LINE_PRIORITY.lyricsFirst)), "running", named, interjection), named);
});

test("the agent line ranks an interjection above lyrics put first and a title below them", () => {
  const interjecting = agentLineContribution(interjection, true, 12, "label");
  const titled = agentLineContribution(named, false, 0, "label");
  assert.equal(interjecting.priority, LINE_PRIORITY.agentInterjection);
  assert.equal(titled.priority, LINE_PRIORITY.agentTitle);
  assert.ok(LINE_PRIORITY.agentInterjection > LINE_PRIORITY.lyricsFirst && LINE_PRIORITY.lyricsFirst > LINE_PRIORITY.agentTitle && LINE_PRIORITY.agentTitle > LINE_PRIORITY.lyrics);
  assert.deepEqual(sorted(lyrics(LINE_PRIORITY.lyricsFirst), interjecting).map((item) => item.item), ["agent-status.session", "media.lyric"]);
  assert.deepEqual(sorted(lyrics(LINE_PRIORITY.lyricsFirst), titled).map((item) => item.item), ["media.lyric", "agent-status.session"]);
  assert.equal(interjecting.measure, "MM" + interjection.title);
  assert.equal(interjecting.extra, 12);
  assert.equal(agentLineContribution(null, false, 0, ""), null);
});
