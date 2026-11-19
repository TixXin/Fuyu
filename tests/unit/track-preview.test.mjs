import assert from "node:assert/strict";
import { test } from "node:test";
import { withTrackArt } from "../../src/features/messages/island/trackPreview.ts";

const track = { source: "plugin", title: "安和桥", mediaControls: true, iconUrl: "note" };

test("a track notice on the collapsed bar takes the cover, then the player's icon, then its own icon", () => {
  assert.equal(withTrackArt(track, { cover: "cover", sourceIcon: "logo" }).iconUrl, "cover");
  assert.equal(withTrackArt(track, { cover: null, sourceIcon: "logo" }).iconUrl, "logo");
  assert.equal(withTrackArt(track, { cover: null, sourceIcon: null }).iconUrl, "note");
  assert.equal(withTrackArt(track, null).iconUrl, "note");
});

test("other previews keep their own icon whatever is playing", () => {
  const alarm = { source: "plugin", title: "起床", iconUrl: "bell" };
  assert.equal(withTrackArt(alarm, { cover: "cover", sourceIcon: "logo" }), alarm);
  assert.equal(withTrackArt(null, { cover: "cover", sourceIcon: "logo" }), null);
});
