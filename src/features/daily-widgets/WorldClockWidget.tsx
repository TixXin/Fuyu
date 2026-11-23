import { useState } from "react";
import { Globe } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { clickOnly } from "../../components/island-widget/clickOnly";
import { useLocale, useTranslation } from "../../i18n";
import { CITIES, DEFAULT_WORLD_CITIES, isCityId, type CityId } from "./cities.ts";
import { CityPicker } from "./CityPicker";
import { setWorldCity } from "./customize.ts";
import { useDaily, useNow } from "./store.ts";
import { zonedClock } from "./sun.ts";

function dayShift(now: Date, zone: string): number {
  const there = zonedClock(now, zone);
  const here = zonedClock(now);
  return Math.round((Date.UTC(there.year, there.month - 1, there.day) - Date.UTC(here.year, here.month - 1, here.day)) / 86_400_000);
}

export function WorldClockWidget() {
  const t = useTranslation().islandWidgets.daily;
  const { locale } = useLocale();
  const now = useNow(10_000);
  const data = useDaily();
  const [picking, setPicking] = useState<number | null>(null);
  const cities: CityId[] = (data.cities ?? DEFAULT_WORLD_CITIES).filter(isCityId);
  const picked = picking === null ? null : cities[picking];
  return (
    <WidgetFrame icon={Globe} title={t.names.worldClock} className="daily-world">
      {picking !== null && picked ? (
        <CityPicker
          value={picked}
          onClose={() => setPicking(null)}
          onPick={(city) => {
            if (city) setWorldCity(cities, picking, city);
            setPicking(null);
          }}
        />
      ) : (
        <div className="daily-world__rows">
          {cities.map((city, at) => {
            const { zone } = CITIES[city];
            const shift = dayShift(now, zone);
            return (
              <button key={`${at}-${city}`} className="daily-world__row" type="button" title={t.changeCity(t.cities[city])} onClick={clickOnly(() => setPicking(at))}>
                <span className="daily-world__city">{t.cities[city]}</span>
                {shift ? <span className="daily-world__shift">{shift > 0 ? `+${shift}` : shift}</span> : null}
                <span className="daily-big">{now.toLocaleTimeString(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false })}</span>
              </button>
            );
          })}
        </div>
      )}
    </WidgetFrame>
  );
}
