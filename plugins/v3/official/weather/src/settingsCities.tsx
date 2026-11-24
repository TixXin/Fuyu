import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_CITIES, coordsId, type SavedCity } from "./config.ts";
import { placeDetail } from "./format.ts";
import { StarIcon, XIcon } from "./icons.tsx";
import type { textFor } from "./text.ts";
import type { WeatherPlace } from "./types.ts";

type Copy = ReturnType<typeof textFor>;

function shouldAutoSearch(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (/[\u3400-\u9fff]/.test(trimmed)) return trimmed.length >= 2;
  return trimmed.length >= 3;
}

export function CityManager({
  ctx,
  cities,
  copy,
  searchCities,
  addCity,
  removeCity,
  setPrimaryCity,
}: {
  ctx: Context;
  cities: readonly SavedCity[];
  copy: Copy;
  searchCities: (query: string) => Promise<WeatherPlace[]>;
  addCity: (place: WeatherPlace) => void;
  removeCity: (id: string) => void;
  setPrimaryCity: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<WeatherPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const debounceRef = useRef<(() => unknown) | null>(null);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) {
        setResults(null);
        setSearchError(null);
        setSearching(false);
        return;
      }
      const seq = ++seqRef.current;
      setSearching(true);
      setSearchError(null);
      try {
        const list = await searchCities(q);
        if (seq !== seqRef.current) return;
        setResults(list);
      } catch (err) {
        if (seq !== seqRef.current) return;
        setResults(null);
        setSearchError(err instanceof Error ? err.message : String(err));
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    },
    [searchCities],
  );

  useEffect(() => {
    debounceRef.current?.();
    debounceRef.current = null;
    const trimmed = draft.trim();
    if (!trimmed) {
      seqRef.current += 1;
      setResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    if (!shouldAutoSearch(trimmed)) return;
    debounceRef.current = ctx.setTimeout(() => {
      void runSearch(trimmed);
    }, 380);
    return () => {
      debounceRef.current?.();
      debounceRef.current = null;
    };
  }, [ctx, draft, runSearch]);

  const savedIds = new Set(cities.map((item) => item.id));
  const atLimit = cities.length >= MAX_CITIES;

  const pickCandidate = (place: WeatherPlace) => {
    addCity(place);
    setDraft("");
    setResults(null);
    setSearchError(null);
  };

  return (
    <div className="fuyu-weather-set__cities-wrap">
      <div className="fuyu-weather-set__row">
        <span className="fuyu-weather-set__label">{copy.cityLabel}</span>
        <div className="fuyu-weather-set__search">
          <input
            type="text"
            className="fuyu-weather-set__input fuyu-weather-set__city"
            aria-label={copy.cityLabel}
            value={draft}
            disabled={atLimit}
            placeholder={atLimit ? copy.cityLimit(MAX_CITIES) : copy.cityPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                debounceRef.current?.();
                void runSearch(draft);
              }
            }}
          />
          <button
            type="button"
            className="fuyu-weather-set__btn"
            disabled={atLimit || searching || !draft.trim()}
            onClick={() => {
              debounceRef.current?.();
              void runSearch(draft);
            }}
          >
            {copy.searchAction}
          </button>
        </div>
      </div>

      {searching && <p className="fuyu-weather-set__hint">{copy.searching}</p>}
      {searchError && <p className="fuyu-weather-set__hint">{copy.offline(searchError)}</p>}

      {results && !searching && (
        <div className="fuyu-weather-set__candidates" role="listbox" aria-label={copy.cityLabel}>
          {results.length === 0 ? (
            <p className="fuyu-weather-set__hint">{copy.noResults}</p>
          ) : (
            results.map((place) => {
              const id = place.id || coordsId(place.latitude, place.longitude);
              const added = savedIds.has(id);
              const detail = placeDetail(place);
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={added}
                  disabled={added}
                  className="fuyu-weather-set__cand"
                  onClick={() => pickCandidate(place)}
                >
                  <span className="fuyu-weather-set__cand-main">
                    <strong>{place.name}</strong>
                    {detail && <span className="fuyu-weather-set__cand-sub">{detail}</span>}
                  </span>
                  {added && <span className="fuyu-weather-set__tag">{copy.addedTag}</span>}
                </button>
              );
            })
          )}
        </div>
      )}

      {cities.length > 0 && (
        <ul className="fuyu-weather-set__saved">
          {cities.map((city, idx) => {
            const primary = idx === 0;
            const detail = placeDetail(city);
            return (
              <li key={city.id} className="fuyu-weather-set__saved-row">
                <div className="fuyu-weather-set__saved-info">
                  <span className="fuyu-weather-set__saved-name">{city.name}</span>
                  <span className="fuyu-weather-set__saved-detail">
                    {detail || (city.latitude === null ? copy.unverifiedCity : "")}
                  </span>
                </div>
                {primary && cities.length > 1 && <span className="fuyu-weather-set__tag">{copy.primaryTag}</span>}
                {cities.length > 1 && (
                  <button
                    type="button"
                    className={primary ? "fuyu-weather-set__icon is-on" : "fuyu-weather-set__icon"}
                    title={primary ? copy.primaryTag : copy.setPrimary}
                    aria-label={copy.setPrimary}
                    aria-pressed={primary}
                    disabled={primary}
                    onClick={() => setPrimaryCity(city.id)}
                  >
                    <StarIcon filled={primary} />
                  </button>
                )}
                <button
                  type="button"
                  className="fuyu-weather-set__icon"
                  title={copy.removeCity}
                  aria-label={copy.removeCity}
                  onClick={() => removeCity(city.id)}
                >
                  <XIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
