import { defaultPrefs } from "../src/model.ts";

const prefs = {
  ...defaultPrefs(),
  tab: "calc",
  history: ["100 美元换成人民币 = 712.35 人民币", "3 斤是多少公斤 = 1.5 公斤", "(1200+350)*12% = 186"],
  fields: { "calc.expr": "5 km to mi", "calc.ans": "186" },
};

export default {
  now: Date.parse("2026-11-20T10:00:00"),
  host: {
    calls: {
      "calculator.prefs": prefs,
    },
  },
  shots: [{ slot: "island.page/v1", file: "page.png" }],
};
