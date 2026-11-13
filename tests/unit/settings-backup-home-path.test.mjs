import assert from "node:assert/strict";
import test from "node:test";
import { expandHome, shortenHome, userHomeOf } from "../../src/features/settings-backup/homePath.ts";

test("the data folder is shown under ~ on macOS and expanded again before it is saved", () => {
  const home = userHomeOf("/Users/demo/.fuyu");
  assert.equal(home, "/Users/demo");
  assert.equal(userHomeOf("/Volumes/Data/fuyu"), null);
  assert.equal(shortenHome("/Users/demo/.fuyu", home), "~/.fuyu");
  assert.equal(shortenHome("/Users/demo", home), "~");
  assert.equal(shortenHome("/Users/demonstration/.fuyu", home), "/Users/demonstration/.fuyu");
  assert.equal(shortenHome("/Volumes/Data/fuyu", home), "/Volumes/Data/fuyu");
  assert.equal(expandHome("~/Dropbox/fuyu", home), "/Users/demo/Dropbox/fuyu");
  assert.equal(expandHome("~", home), "/Users/demo");
  assert.equal(expandHome("~other/fuyu", home), "~other/fuyu");
  assert.equal(expandHome("~/x", null), "~/x");
  assert.equal(shortenHome("/Users/demo/.fuyu", null), "/Users/demo/.fuyu");
});
