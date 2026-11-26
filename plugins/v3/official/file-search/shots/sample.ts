import type { FileHit, SearchResult } from "../src/model.ts";

const QUERY = "季度报告";

const files: [name: string, folder: string][] = [
  ["2026 第三季度报告.docx", "工作\\汇报\\2026"],
  ["2026 第三季度报告 定稿.pdf", "工作\\汇报\\2026"],
  ["季度报告模板.pptx", "文档\\模板"],
  ["第二季度报告-销售数据.xlsx", "工作\\销售\\Q2"],
  ["季度报告", "工作\\归档"],
  ["季度报告-修订意见.md", "文档\\笔记"],
  ["2025 第四季度报告.docx", "工作\\归档\\2025"],
];

const hits: FileHit[] = files.map(([name, folder]) => ({ path: `${folder}\\${name}`, name, folder }));

const result: SearchResult = {
  query: QUERY,
  status: "ok",
  backend: "everything",
  hits,
  truncated: false,
  canStart: true,
  message: "",
};

export default {
  host: {
    calls: {
      lastQuery: QUERY,
      search: result,
    },
  },
  shots: [{ slot: "island.page/v1", file: "page.png" }],
};
