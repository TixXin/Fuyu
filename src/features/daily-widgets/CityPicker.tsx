import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "../../i18n";
import { CITY_IDS, type CityId } from "./cities.ts";
import { editorKeys, stopPointer, useOwnWheel } from "./inputGuards.ts";
import { clickOnly } from "../../components/island-widget/clickOnly";

type CityPickerProps = {
  value: CityId | null;
  onPick: (city: CityId | null) => void;
  onClose: () => void;
  systemOption?: boolean;
};

export function CityPicker({ value, onPick, onClose, systemOption = false }: CityPickerProps) {
  const t = useTranslation().islandWidgets.daily;
  const list = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useOwnWheel(list);
  useEffect(() => {
    const box = list.current;
    const chosen = box?.querySelector<HTMLElement>("[aria-checked='true']") ?? box?.querySelector<HTMLElement>("button");
    if (box && chosen) box.scrollTop = chosen.offsetTop - (box.clientHeight - chosen.offsetHeight) / 2;
    chosen?.focus({ preventScroll: true });
    const away = (event: PointerEvent) => {
      if (!list.current?.contains(event.target as Node)) close.current();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, []);
  const option = (city: CityId | null, label: string) => (
    <button
      key={city ?? "system"}
      className="daily-picker__option"
      type="button"
      role="menuitemradio"
      aria-checked={value === city}
      onClick={clickOnly(() => onPick(city))}
    >
      <span>{label}</span>
      {value === city ? <Check size={11} strokeWidth={2.6} aria-hidden="true" /> : null}
    </button>
  );
  return (
    <div className="daily-picker" role="menu" aria-label={t.chooseCity} ref={list} onPointerDown={stopPointer} onKeyDown={editorKeys(null, onClose)}>
      {systemOption ? option(null, t.followSystem) : null}
      {CITY_IDS.map((city) => option(city, t.cities[city]))}
    </div>
  );
}
