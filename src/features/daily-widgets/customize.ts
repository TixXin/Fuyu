import type { CityId } from "./cities.ts";
import { COUNTDOWN_NAME_MAX, HABIT_NAME_MAX, MAX_COUNTDOWNS, MAX_HABITS, WATER_GOALS, withoutHabit, type CountdownEntry } from "./dailyFormat.ts";
import { commitDaily, currentDaily } from "./store.ts";

export function setHabitNames(names: readonly string[]) {
  const habitNames = names.slice(0, MAX_HABITS).map((name) => name.slice(0, HABIT_NAME_MAX));
  if (!habitNames.length) return;
  commitDaily({ ...currentDaily(), habitNames });
}

export function removeHabit(names: readonly string[], at: number) {
  if (names.length <= 1 || at < 0 || at >= names.length) return;
  const state = currentDaily();
  commitDaily({ ...state, habitNames: names.filter((_, index) => index !== at), habits: withoutHabit(state.habits, at) });
}

export function saveCountdown(at: number | null, entry: CountdownEntry): number {
  const state = currentDaily();
  const base = { name: entry.name.trim().slice(0, COUNTDOWN_NAME_MAX), date: entry.date };
  const clean: CountdownEntry =
    entry.calendar === "lunar" ? (entry.leap ? { ...base, calendar: "lunar", leap: true } : { ...base, calendar: "lunar" }) : base;
  const list = [...state.countdowns];
  const index = at === null || at >= list.length ? Math.min(list.length, MAX_COUNTDOWNS - 1) : at;
  list[index] = clean;
  const countdowns = list.slice(0, MAX_COUNTDOWNS);
  commitDaily({ ...state, countdowns, countdownAt: index });
  return index;
}

export function removeCountdown(at: number) {
  const state = currentDaily();
  const countdowns = state.countdowns.filter((_, index) => index !== at);
  commitDaily({ ...state, countdowns, countdownAt: Math.max(0, Math.min(state.countdownAt, countdowns.length - 1)) });
}

export function showNextCountdown() {
  const state = currentDaily();
  if (state.countdowns.length < 2) return;
  commitDaily({ ...state, countdownAt: (state.countdownAt + 1) % state.countdowns.length });
}

export function setWorldCity(cities: readonly CityId[], at: number, city: CityId) {
  commitDaily({ ...currentDaily(), cities: cities.map((current, index) => (index === at ? city : current)) });
}

export function setSunCity(city: CityId | null) {
  commitDaily({ ...currentDaily(), sunCity: city });
}

export function cycleWaterGoal() {
  const state = currentDaily();
  const at = WATER_GOALS.findIndex((goal) => goal === state.waterGoal);
  commitDaily({ ...state, waterGoal: WATER_GOALS[(at + 1) % WATER_GOALS.length] ?? WATER_GOALS[0] });
}
