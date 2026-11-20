import { defaultPrefs } from "../src/model.ts";

const prefs = {
  ...defaultPrefs(),
  tab: "loan",
  fields: { "loan.kind": "combo", "loan.commercial": "120", "loan.fund": "60", "loan.years": "30" },
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
