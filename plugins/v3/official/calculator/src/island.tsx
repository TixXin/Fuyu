import type { Context } from "@fuyu/plugin-base";
import { useEffect, useRef } from "react";
import { CalculatorIcon } from "./icons.tsx";
import { PAGE_ID, shownTab, visibleTabs, type Tab } from "./model.ts";
import { BmiPanel } from "./panels/BmiPanel.tsx";
import { CalcPanel } from "./panels/CalcPanel.tsx";
import { CurrencyPanel } from "./panels/CurrencyPanel.tsx";
import { DatePanel } from "./panels/DatePanel.tsx";
import { KinshipPanel } from "./panels/KinshipPanel.tsx";
import { LoanPanel } from "./panels/LoanPanel.tsx";
import { RadixPanel } from "./panels/RadixPanel.tsx";
import { TaxPanel } from "./panels/TaxPanel.tsx";
import { UnitPanel } from "./panels/UnitPanel.tsx";
import { UpperPanel } from "./panels/UpperPanel.tsx";
import { PAGE_TITLE, text } from "./text.ts";
import { UNIT_CATEGORIES, type UnitCategory } from "./units.ts";
import { usePrefs, type PrefsApi } from "./usePrefs.ts";
import "./styles.css";

function isUnitTab(tab: Tab): tab is UnitCategory {
  return (UNIT_CATEGORIES as string[]).includes(tab);
}

function Panel({ tab, api, ctx }: { tab: Tab; api: PrefsApi; ctx: Context }) {
  if (isUnitTab(tab)) return <UnitPanel key={tab} api={api} category={tab} />;
  switch (tab) {
    case "currency":
      return <CurrencyPanel api={api} ctx={ctx} />;
    case "date":
      return <DatePanel api={api} />;
    case "radix":
      return <RadixPanel api={api} />;
    case "upper":
      return <UpperPanel api={api} />;
    case "tax":
      return <TaxPanel api={api} />;
    case "loan":
      return <LoanPanel api={api} />;
    case "kinship":
      return <KinshipPanel api={api} />;
    case "bmi":
      return <BmiPanel api={api} />;
    default:
      return <CalcPanel api={api} />;
  }
}

export default function apply(ctx: Context) {
  function CalculatorPage() {
    const api = usePrefs(ctx);
    const tab = shownTab(api.prefs.tab, api.prefs.settings);
    const current = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
      current.current?.scrollIntoView?.({ block: "nearest" });
    }, [tab]);
    return (
      <div className="fuyu-calc">
        <nav className="fuyu-calc__nav" aria-label={text.title}>
          {visibleTabs(api.prefs.settings).map((item) => (
            <button key={item} ref={item === tab ? current : undefined} type="button" className={item === tab ? "fuyu-calc__tab is-on" : "fuyu-calc__tab"} aria-current={item === tab ? "page" : undefined} onClick={() => api.update({ tab: item })}>
              {text.tabs[item]}
            </button>
          ))}
        </nav>
        <section className="fuyu-calc__body" aria-label={text.tabs[tab]}>
          <Panel tab={tab} api={api} ctx={ctx} />
        </section>
      </div>
    );
  }

  ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: CalculatorPage, icon: CalculatorIcon });
}
