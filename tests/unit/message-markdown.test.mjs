import assert from "node:assert/strict";
import test from "node:test";
import { looksLikeMarkdown, markdownToPlainLine } from "../../src/components/markdown/markdownText.ts";
import { linkify, parseInline, parseMarkdown } from "../../src/components/markdown/parseMarkdown.ts";
import { messagePreviewText } from "../../src/features/messages/messagePreview.ts";

const RANK = [
  "**WebDev 前 20 有变动**",
  "",
  "| 排名 | 模型 | 分数 |",
  "|---:|---|---:|",
  "| 1 | Model-A | 1512 |",
  "| 2 | Model-B | 1498 |",
  "",
  "完整榜单：[WebDev Arena](https://example.com/webdev)",
].join("\r\n");

test("bot messages with a table, bold text or a link are treated as Markdown", () => {
  assert.equal(looksLikeMarkdown(RANK), true);
  assert.equal(looksLikeMarkdown("排名 | 模型\n--- | ---\n1 | A"), true, "a table alone");
  assert.equal(looksLikeMarkdown("部署 **完成**"), true, "bold alone");
  assert.equal(looksLikeMarkdown("看 [日志](https://example.com/log)"), true, "a link alone");
  assert.equal(looksLikeMarkdown("今日\n# 构建\n- 通过\n- 失败 0"), true, "a heading and a list");
});

test("everyday chat with *, _, # and | stays plain text", () => {
  for (const text of [
    "周五 *下午* 3 点开会，#2 会议室",
    "文件名是 report_final_v2.docx，记得改成 snake_case_name",
    "5*3=15，a*b*c 也行",
    "# 号键坏了",
    "A | B 两个方案你挑",
    "- 买菜\n明天见",
    "C# 和 F# 哪个好",
    "https://example.com/a_b_c",
  ]) assert.equal(looksLikeMarkdown(text), false, text);
});

test("message options: no italics, kept line breaks, bare links", () => {
  const options = { emphasis: false, breaks: true, autolink: true };
  assert.deepEqual(parseInline("snake_case_name 和 *星号*", options), [{ type: "text", text: "snake_case_name 和 *星号*" }]);
  assert.deepEqual(parseMarkdown("**标题**\n第二行", options), [{
    type: "paragraph",
    content: [{ type: "strong", text: "标题" }, { type: "text", text: "\n第二行" }],
  }]);
  assert.deepEqual(parseInline("详情：https://example.com/a?b=1。谢谢", options), [
    { type: "text", text: "详情：" },
    { type: "link", text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
    { type: "text", text: "。谢谢" },
  ]);
  assert.deepEqual(parseInline("*斜体*"), [{ type: "em", text: "斜体" }], "other callers keep italics");
});

test("linkify only turns http(s) addresses into links", () => {
  assert.deepEqual(linkify("ftp://a.b 和 javascript:alert(1)"), [{ type: "text", text: "ftp://a.b 和 javascript:alert(1)" }]);
  assert.deepEqual(linkify("(https://example.com/x)").map((part) => part.type), ["text", "link", "text"]);
});

test("one-line previews drop Markdown symbols and leave plain text untouched", () => {
  assert.equal(markdownToPlainLine(RANK), "WebDev 前 20 有变动 排名 · 模型 · 分数 1 · Model-A · 1512 2 · Model-B · 1498 完整榜单：WebDev Arena");
  assert.equal(markdownToPlainLine("周五 *下午* 开会"), "周五 *下午* 开会");
  assert.equal(
    messagePreviewText({ source: "telegram", kind: "toast", title: "bot", body: RANK, receivedAt: 0 }).startsWith("bot：WebDev 前 20 有变动 排名 · 模型"),
    true,
  );
  assert.equal(messagePreviewText({ source: "qq", title: "小林", body: "看 **这个**", receivedAt: 0 }), "小林：看 这个");
});
