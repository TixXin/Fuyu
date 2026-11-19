import assert from "node:assert/strict";
import test from "node:test";
import { parseInline, parseMarkdown } from "../../src/components/markdown/parseMarkdown.ts";

test("blocks: headings, paragraphs, lists, quotes, code and rules", () => {
  const blocks = parseMarkdown([
    "# 番茄钟", "", "第一行", "接着一行", "", "- 甲", "- 乙", "  续行", "", "1. 一", "2. 二", "", "> 引用", "", "```", "a <b>", "```", "---",
  ].join("\r\n"));
  assert.deepEqual(blocks.map((block) => block.type), ["heading", "paragraph", "list", "list", "quote", "code", "rule"]);
  assert.deepEqual(blocks[0], { type: "heading", level: 1, content: [{ type: "text", text: "番茄钟" }] });
  assert.deepEqual(blocks[1], { type: "paragraph", content: [{ type: "text", text: "第一行 接着一行" }] });
  assert.deepEqual(blocks[2], { type: "list", ordered: false, items: [[{ type: "text", text: "甲" }], [{ type: "text", text: "乙 续行" }]] });
  assert.equal(blocks[3].type === "list" && blocks[3].ordered, true);
  assert.deepEqual(blocks[5], { type: "code", text: "a <b>" });
});

test("inline: code, bold, italics and only http(s) links", () => {
  assert.deepEqual(parseInline("按 **Ctrl+Alt+P** 开始，`todos:read` 和 *斜体*"), [
    { type: "text", text: "按 " }, { type: "strong", text: "Ctrl+Alt+P" }, { type: "text", text: " 开始，" },
    { type: "code", text: "todos:read" }, { type: "text", text: " 和 " }, { type: "em", text: "斜体" },
  ]);
  assert.deepEqual(parseInline("见 [文档](https://example.com/a)"), [{ type: "text", text: "见 " }, { type: "link", text: "文档", href: "https://example.com/a" }]);
  assert.deepEqual(parseInline("[x](javascript:alert(1))"), [{ type: "text", text: "x)" }], "a script link keeps only its text");
  assert.deepEqual(parseInline("![图](https://example.com/a.png)"), [{ type: "text", text: "图" }], "images show their alt text");
});

test("HTML stays text", () => {
  assert.deepEqual(parseMarkdown("<script>alert(1)</script>"), [{ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] }]);
});

test("tables: a header row, a delimiter row and body rows, with alignment", () => {
  const blocks = parseMarkdown(["前一段", "| 平台 | 程序 | 次数 |", "|:---|:---:|---:|", "| Windows | `powershell.exe` | 1 |", "| Mac | **ps** |", "", "后一段"].join("\r\n"));
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "table", "paragraph"]);
  assert.deepEqual(blocks[1], {
    type: "table",
    align: ["left", "center", "right"],
    head: [[{ type: "text", text: "平台" }], [{ type: "text", text: "程序" }], [{ type: "text", text: "次数" }]],
    rows: [
      [[{ type: "text", text: "Windows" }], [{ type: "code", text: "powershell.exe" }], [{ type: "text", text: "1" }]],
      [[{ type: "text", text: "Mac" }], [{ type: "strong", text: "ps" }], []],
    ],
  });
});

test("tables: no outer pipes, escaped pipes, and lines with pipes that are not a table", () => {
  const bare = parseMarkdown("a | b\n--- | ---\n1 \\| 2 | 3 | extra");
  assert.deepEqual(bare, [{
    type: "table",
    align: [null, null],
    head: [[{ type: "text", text: "a" }], [{ type: "text", text: "b" }]],
    rows: [[[{ type: "text", text: "1 | 2" }], [{ type: "text", text: "3" }]]],
  }]);
  assert.deepEqual(parseMarkdown("a | b\nc | d").map((block) => block.type), ["paragraph"], "no delimiter row");
  assert.deepEqual(parseMarkdown("| a | b |\n|---|\n| 1 | 2 |").map((block) => block.type), ["paragraph"], "the delimiter row has a different number of columns");
  assert.deepEqual(parseMarkdown("| a |\n|---|\n- item").map((block) => block.type), ["table", "list"], "the table ends where another block starts");
});
