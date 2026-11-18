import assert from "node:assert/strict";
import test from "node:test";
import { previewMetaRows, previewNote } from "../../src/features/clipboard/previewMeta.ts";

const LABELS = {
  source: "来源",
  copiedAt: "复制于",
  note: "备注",
  tags: "标签",
  none: "—",
  appName: "浮屿",
  screenshotSource: "截图",
  otherDevice: "其他设备",
};

const BASE_ITEM = {
  id: "item-1",
  kind: "text",
  hash: "h1",
  createdAt: 1000,
  copiedAt: 2000,
  preview: "preview",
  text: "full content",
};

test("previewNote trims outer whitespace and omits blank notes", () => {
  assert.equal(previewNote(undefined), null);
  assert.equal(previewNote(""), null);
  assert.equal(previewNote("   \n\t "), null);
  assert.equal(previewNote("  第一行\n第二行长备注  "), "第一行\n第二行长备注");
});

test("previewMetaRows omits note row when note is empty and keeps source, time and tags", () => {
  const rows = previewMetaRows(
    { ...BASE_ITEM, source: { path: "C:\\code.exe", name: "VS Code" }, note: "   " },
    "11/17 20:00",
    LABELS,
  );
  assert.deepEqual(rows, [
    { key: "source", label: "来源", value: "VS Code" },
    { key: "copiedAt", label: "复制于", value: "11/17 20:00" },
    { key: "tags", label: "标签", value: "—" },
  ]);
});

test("previewMetaRows includes full multiline note and formatted tags when present", () => {
  const longNote = "这是一条超过列表单行省略号宽度的完整长备注，用于在空格预览窗和宽版详情栏完整阅读\n第二行补充说明";
  const rows = previewMetaRows(
    {
      ...BASE_ITEM,
      note: `  ${longNote}  `,
      tags: ["设计", "周报"],
    },
    "11/17 20:05",
    LABELS,
  );
  assert.deepEqual(rows, [
    { key: "source", label: "来源", value: "—" },
    { key: "copiedAt", label: "复制于", value: "11/17 20:05" },
    { key: "note", label: "备注", value: longNote, multiline: true },
    { key: "tags", label: "标签", value: "#设计 #周报" },
  ]);
});
