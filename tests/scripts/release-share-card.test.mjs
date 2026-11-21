import assert from "node:assert/strict";
import test from "node:test";
import { latestNotesVersion, parseReleaseNotes } from "../../scripts/release/share-card-notes.mjs";

test("latestNotesVersion compares versions, not file names", () => {
  const files = ["README.md", "v0.3.9.md", "v0.3.12-beta.1.md", "v0.3.12-beta.10.md", "v0.3.12-beta.2.md", "v0.3.11.md"];
  assert.equal(latestNotesVersion(files), "0.3.12-beta.10");
  assert.equal(latestNotesVersion([...files, "v0.3.12.md"]), "0.3.12");
  assert.equal(latestNotesVersion(["README.md"]), null);
});

const GROUPED = [
  "## 关于这个版本",
  "",
  "**下载**：[Windows](https://example.invalid/a.exe)",
  "",
  "## 更新内容",
  "",
  "### 截图",
  "",
  "- **新标注工具**：模糊、直线，按 `X` 打码。",
  "- （Mac）**能录屏了**：区域录屏。",
  "- （Windows）**全屏游戏不再截成黑屏**。",
  "",
  "### 修复",
  "",
  "- （Windows）歌手名不再带着 `专辑名`。",
  "",
  "---",
  "",
  "## About this release",
  "",
  "## What's New",
  "",
  "### Screenshots",
  "",
  "- **New markup tools**: blur and lines.",
  "- (Mac) **Screen recording**: record a region.",
  "",
  "### Fixes",
  "",
  "- (Windows) Artist names no longer carry the album.",
  "",
  "## Downloads",
  "",
  "- `Fuyu.exe`: installer.",
].join("\r\n");

test("grouped notes keep their sections, platforms and fixes in both languages", () => {
  const { zh, en } = parseReleaseNotes(GROUPED);
  assert.deepEqual(zh, [
    { title: "截图", fix: false, items: [
      { title: "新标注工具", desc: "模糊、直线，按 X 打码。", platform: null, children: [] },
      { title: "能录屏了", desc: "区域录屏。", platform: "Mac", children: [] },
      { title: "全屏游戏不再截成黑屏", desc: "", platform: "Windows", children: [] },
    ] },
    { title: "", fix: true, items: [{ title: "歌手名不再带着 专辑名。", desc: "", platform: "Windows", children: [] }] },
  ]);
  assert.deepEqual(en.map((section) => [section.title, section.fix, section.items.map((item) => [item.title, item.platform])]), [
    ["Screenshots", false, [["New markup tools", null], ["Screen recording", "Mac"]]],
    ["", true, [["Artist names no longer carry the album.", "Windows"]]],
  ]);
});

const FLAT = [
  "## 更新内容",
  "",
  "- **岛可以吸附到底边**：设置 → 位置。",
  "- **歌词**：",
  "  - 前奏时显示（新）：可以选。",
  "- **修复**：",
  "  - 歌词不再卡住。",
  "  - （Mac）四指切换桌面时岛不再消失。",
  "",
  "---",
].join("\n");

test("flat notes turn the bold 修复 item's sub-items into the fixes section", () => {
  const { zh, en } = parseReleaseNotes(FLAT);
  assert.deepEqual(zh.map((section) => [section.title, section.fix, section.items.map((item) => item.title)]), [
    ["", false, ["岛可以吸附到底边", "歌词"]],
    ["", true, ["歌词不再卡住。", "四指切换桌面时岛不再消失。"]],
  ]);
  assert.equal(zh[1].items[1].platform, "Mac");
  assert.deepEqual(zh[0].items[1].children, [{ title: "前奏时显示（新）：可以选。", desc: "", platform: null, children: [] }]);
  assert.deepEqual(en, []);
});
