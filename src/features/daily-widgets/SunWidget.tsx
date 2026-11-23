import { useState } from "react";
import { Sunrise } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { clickOnly } from "../../components/island-widget/clickOnly";
import { useTranslation } from "../../i18n";
import { systemZone } from "./cities.ts";
import { CityPicker } from "./CityPicker";
import { setSunCity } from "./customize.ts";
import { useDaily, useNow } from "./store.ts";
import { minutesText, sunDay, sunPlace, zonedClock } from "./sun.ts";

export function SunWidget() {
  const t = useTranslation().islandWidgets.daily;
  const now = useNow(60_000);
  const data = useDaily();
  const [picking, setPicking] = useState(false);
  const place = sunPlace(data.sunCity, systemZone());
  const clock = zonedClock(now, place.zone);
  const { rise, set } = sunDay(clock, place.latitude, place.longitude ?? undefined);
  const along = Math.min(1, Math.max(0, (clock.minute - rise) / Math.max(1, set - rise)));
  const up = clock.minute >= rise && clock.minute <= set;
  const x = 10 + along * 76;
  const y = 46 - Math.sin(along * Math.PI) * 32;
  const where = place.city ? t.cities[place.city] : t.sunGuess;
  return (
    <WidgetFrame icon={Sunrise} title={t.names.sun} className="daily-sun">
      {picking ? (
        <CityPicker
          value={data.sunCity}
          systemOption
          onClose={() => setPicking(false)}
          onPick={(city) => {
            setSunCity(city);
            setPicking(false);
          }}
        />
      ) : (
        <>
          <svg className="daily-sun__arc" viewBox="0 6 96 44" aria-hidden="true">
            <path className="daily-sun__path" d="M10 46 Q48 -18 86 46" />
            <line className="daily-sun__horizon" x1="4" y1="46" x2="92" y2="46" />
            <circle className="daily-sun__dot" data-up={up || undefined} cx={x} cy={y} r="6" />
          </svg>
          <div className="daily-sun__times daily-small">
            <span title={t.sunrise}>{minutesText(rise)}</span>
            <button className="daily-link daily-sun__place" type="button" title={`${place.city ? where : t.followSystem} · ${t.chooseCity}`} onClick={clickOnly(() => setPicking(true))}>
              {where}
            </button>
            <span className="daily-muted" title={t.sunset}>
              {minutesText(set)}
            </span>
          </div>
        </>
      )}
    </WidgetFrame>
  );
}
