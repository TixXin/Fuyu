import assert from "node:assert/strict";
import test from "node:test";
import { applySessionFilters, folderKey, matchesFilter, normalizeSessionFilters, similarFolderPattern } from "../../src/features/agent-status/sessionFilters.ts";

const session = (cwd, title = null, lastPrompt = null) => ({ cwd, title, lastPrompt });

test("a folder rule hides the folder and its subfolders, whatever the slashes and case", () => {
  const rule = { kind: "folder", value: "E:\\Projects\\Scratch\\" };
  assert.equal(folderKey(rule.value), "e:/projects/scratch");
  assert.equal(matchesFilter(session("e:/projects/scratch"), rule), true);
  assert.equal(matchesFilter(session("E:\\Projects\\scratch\\sub\\dir"), rule), true);
  assert.equal(matchesFilter(session("E:\\Projects\\scratch-two"), rule), false, "a sibling with the same start is not inside");
  assert.equal(matchesFilter(session(null), rule), false);
});

test("a folder rule with * matches throwaway temp folders whose names change every run", () => {
  const rule = { kind: "folder", value: "*/agy-title-*" };
  assert.equal(matchesFilter(session("/private/var/folders/x1/T/agy-title-hTE0sa"), rule), true);
  assert.equal(matchesFilter(session("C:\\Users\\me\\AppData\\Local\\Temp\\agy-title-Q9zk2p"), rule), true);
  assert.equal(matchesFilter(session("/Users/me/projects/agy-title"), rule), false, "the plain project without the run suffix stays");
  assert.equal(matchesFilter(session("/Users/me/projects/fuyu"), rule), false);
  assert.equal(matchesFilter(session("/Users/me/a.b(c)"), { kind: "folder", value: "*/a.b(c)" }), true, "regex characters in the rule are literal");
  assert.equal(matchesFilter(session("/Users/me/axb(c)"), { kind: "folder", value: "*/a.b(c)" }), false);
  assert.equal(matchesFilter(session("/Users/me/fuyu"), { kind: "folder", value: "*" }), false, "a bare * does not hide every session");
  assert.equal(matchesFilter(session("/Users/me/fuyu"), { kind: "folder", value: "*/*" }), false);
});

test("a similar-folder pattern is offered only for a name ending in a random run suffix", () => {
  assert.equal(similarFolderPattern("/private/var/folders/x1/T/agy-title-hTE0sa"), "*/agy-title-*");
  assert.equal(similarFolderPattern("C:\\Users\\me\\AppData\\Local\\Temp\\tmp.Xa12bcQ\\"), "*/tmp.*");
  assert.equal(similarFolderPattern("/Users/me/projects/my-project"), null);
  assert.equal(similarFolderPattern("/Users/me/projects/fuyu"), null);
  assert.equal(similarFolderPattern("/Users/me/release-2024"), null);
  assert.equal(similarFolderPattern(null), null);
});

test("a text rule matches the title or the latest prompt, ignoring case", () => {
  const rule = { kind: "prompt", value: " /LOOP " };
  assert.equal(matchesFilter(session("C:/x", "/loop check CI"), rule), true);
  assert.equal(matchesFilter(session("C:/x", "fix login", "run /loop 5m"), rule), true);
  assert.equal(matchesFilter(session("C:/x", "fix login", "write tests"), rule), false);
});

test("filtering keeps the same array when nothing is hidden", () => {
  const sessions = [session("C:/a", "one"), session("C:/b", "two")];
  assert.equal(applySessionFilters(sessions, []), sessions);
  assert.equal(applySessionFilters(sessions, [{ kind: "prompt", value: "three" }]), sessions);
  assert.deepEqual(applySessionFilters(sessions, [{ kind: "folder", value: "C:\\a" }]), [sessions[1]]);
});

test("saved rules: only well-formed, non-empty and distinct ones", () => {
  assert.deepEqual(normalizeSessionFilters("oops"), []);
  assert.deepEqual(normalizeSessionFilters([
    { kind: "folder", value: " C:\\a " },
    { kind: "folder", value: "c:/A/" },
    { kind: "prompt", value: "" },
    { kind: "other", value: "x" },
    { kind: "prompt", value: "Loop" },
    { kind: "prompt", value: "loop" },
    null,
  ]), [{ kind: "folder", value: "C:\\a" }, { kind: "prompt", value: "Loop" }]);
  assert.equal(normalizeSessionFilters(Array.from({ length: 60 }, (_, i) => ({ kind: "prompt", value: `r${i}` }))).length, 50);
});
