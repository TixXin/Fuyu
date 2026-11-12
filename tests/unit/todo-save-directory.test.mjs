import assert from "node:assert/strict";
import test from "node:test";
import { movedSaveDirectory, sameDirectory } from "../../src/features/todos/saveDirectory.ts";

const legacy = String.raw`C:\Users\me\Documents\FocuSD`;
const home = String.raw`C:\Users\me\.fuyu\todo`;

test("the old default folder moves into the home folder", () => {
  assert.equal(movedSaveDirectory(legacy, legacy, home), home);
  assert.equal(movedSaveDirectory(String.raw`c:\users\me\documents\focusd\ `, legacy, home), home);
  assert.equal(movedSaveDirectory("C:/Users/me/Documents/FocuSD/", legacy, home), home);
});

test("a folder the user picked stays", () => {
  assert.equal(movedSaveDirectory(String.raw`D:\Notes`, legacy, home), null);
  assert.equal(movedSaveDirectory("", legacy, home), null);
});

test("nothing moves while the home is still the app data folder", () => {
  assert.equal(movedSaveDirectory(legacy, legacy, legacy), null);
  assert.equal(movedSaveDirectory(legacy, legacy, ""), null);
});

test("folders compare without case, slashes or a trailing separator", () => {
  assert.ok(sameDirectory("C:/A/b/", String.raw`c:\a\B`));
  assert.ok(!sameDirectory("", ""));
});
