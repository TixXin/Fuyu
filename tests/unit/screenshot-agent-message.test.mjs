import assert from "node:assert/strict";
import test from "node:test";
import { agentMessage, sourceLine } from "../../src/features/screenshot/agentMessage.ts";

const text = { source: "来源：" };
const path = "/Users/me/.fuyu/screenshots/a.png";

test("without an instruction or a source there is nothing to add, so the path is pasted as before", () => {
  assert.equal(agentMessage(path, { text }), null);
  assert.equal(agentMessage(path, { instruction: "   ", source: null, text }), null);
});

test("the instruction comes first, then where the screenshot was taken, then the path", () => {
  const source = { app: "Google Chrome", title: "Pull requests", url: "https://github.com/pulls" };
  assert.equal(
    agentMessage(path, { instruction: " 这个按钮没对齐，修一下 ", source, text }),
    `这个按钮没对齐，修一下\n来源：Google Chrome — Pull requests\nhttps://github.com/pulls\n"${path}"`,
  );
  assert.equal(agentMessage(path, { source: { app: "Code", title: null, url: null }, text: { source: "Source: " } }), `Source: Code\n"${path}"`);
});

test("a source without an app name is left out", () => {
  assert.equal(sourceLine({ app: "", title: "x", url: null }), null);
  assert.equal(agentMessage(path, { source: { app: "", title: "x", url: "https://a.b" }, text }), null);
});
