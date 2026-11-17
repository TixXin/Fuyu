import assert from "node:assert/strict";
import test from "node:test";
import { aggregateContributions, lineBelow, LINE_PRIORITY, shownLine } from "../../src/features/plugin-kernel/islandContributions.ts";
import { meetingLineContributions, meetingSharesBar } from "../../src/features/calendar/plugin/meetingLine.ts";
import { lyricLineContribution } from "../../src/features/media/plugin/lyricLine.ts";

const t = { island: { nowPlaying: (text) => `Now playing: ${text}`, lyricLine: (text) => `Lyric: ${text}` } };
const lyric = (text, lyricsFirst = false) => lyricLineContribution({ text, song: false, longest: "a long line" }, lyricsFirst, t);
const line = (item, priority, extra = {}) => ({ kind: "line", item, priority, ...extra });
const bar = (...lists) => aggregateContributions(lists, true).lines;
const sharing = (lines) => meetingSharesBar(lineBelow(lines, LINE_PRIORITY.meeting));

test("a meeting with nothing to share the bar with stays on it between beats", () => {
  const below = bar([line("todos.title", LINE_PRIORITY.todoTitle)]);
  assert.equal(sharing(below), false);
  const shown = meetingLineContributions(true, true, sharing(below), false);
  assert.equal(shownLine(bar(shown, below))?.item, "calendar.meeting");
});

test("a meeting takes turns with the lyrics: on a beat it shows, between beats the lyrics come back", () => {
  for (const lyricsFirst of [false, true]) {
    const below = bar([lyric("la la", lyricsFirst)]);
    assert.equal(sharing(below), true);
    assert.equal(shownLine(bar(meetingLineContributions(true, true, true, true), below))?.item, "calendar.meeting");
    assert.equal(shownLine(bar(meetingLineContributions(true, true, true, false), below))?.item, "media.lyric");
  }
});

test("a waiting lyric still counts as sharing, and the meeting keeps its join button between beats", () => {
  const waiting = lyric("");
  assert.equal(waiting.reserve, true);
  assert.equal(sharing(bar([waiting])), true);
  assert.deepEqual(meetingLineContributions(true, true, true, false), [{ kind: "trail", item: "calendar.join" }]);
});

test("an agent interjection between the meeting and the lyrics keeps the meeting on the bar", () => {
  const below = bar([line("agent-status.session", LINE_PRIORITY.agentInterjection), lyric("la la", true)]);
  assert.equal(sharing(below), false);
  assert.equal(shownLine(bar(meetingLineContributions(true, true, false, false), below))?.item, "calendar.meeting");
});

test("no meeting, or no text on the bar, gives nothing", () => {
  assert.deepEqual(meetingLineContributions(false, true, false, true), []);
  assert.deepEqual(meetingLineContributions(true, false, false, true), []);
});

test("the lyric line ranks above the agent title only when lyrics are put first", () => {
  assert.equal(lyric("la la", true).priority, LINE_PRIORITY.lyricsFirst);
  assert.equal(lyric("la la").priority, LINE_PRIORITY.lyrics);
  assert.equal(lyric("la la").label, "Lyric: la la");
  assert.equal(lyricLineContribution(null, true, t), null);
});
