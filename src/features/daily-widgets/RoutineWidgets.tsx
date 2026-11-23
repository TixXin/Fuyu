import { useRef } from "react";
import { Droplets, Minus, Plus, StickyNote } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../i18n";
import { cycleWaterGoal } from "./customize.ts";
import { dayKey } from "./days.ts";
import { stopPointer, useOwnWheel } from "./inputGuards.ts";
import { addCup, setNote, useDaily, useNow } from "./store.ts";
import { clickOnly } from "../../components/island-widget/clickOnly";

export function WaterWidget() {
  const t = useTranslation().islandWidgets.daily;
  const data = useDaily();
  const today = dayKey(useNow(60_000));
  const cups = data.water[today] ?? 0;
  const goal = data.waterGoal;
  const aside = (
    <button className="daily-link" type="button" title={t.waterGoal(goal)} data-done={cups >= goal || undefined} onClick={clickOnly(cycleWaterGoal)}>
      {t.cups(cups, goal)}
    </button>
  );
  return (
    <WidgetFrame icon={Droplets} title={t.names.water} aside={aside} className="daily-water">
      <div className="daily-water__body">
        <div className="daily-water__cup" aria-hidden="true">
          <b style={{ height: `${Math.min(1, cups / goal) * 100}%` }} />
        </div>
        <div className="daily-water__buttons">
          <button className="daily-button" type="button" aria-label={t.addCup} title={t.addCup} onClick={clickOnly(() => addCup(today, 1))}>
            <Plus size={13} strokeWidth={2.6} />
          </button>
          {cups ? (
            <button className="daily-button daily-button--plain" type="button" aria-label={t.removeCup} title={t.removeCup} onClick={clickOnly(() => addCup(today, -1))}>
              <Minus size={12} strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      </div>
    </WidgetFrame>
  );
}

export function NoteWidget() {
  const t = useTranslation().islandWidgets.daily;
  const data = useDaily();
  const text = useRef<HTMLTextAreaElement>(null);
  useOwnWheel(text);
  return (
    <WidgetFrame icon={StickyNote} title={t.names.note} className="daily-note">
      <textarea
        ref={text}
        className="daily-note__text"
        value={data.note}
        placeholder={t.notePlaceholder}
        aria-label={t.names.note}
        spellCheck={false}
        onPointerDown={stopPointer}
        onChange={(event) => setNote(event.target.value)}
      />
    </WidgetFrame>
  );
}
