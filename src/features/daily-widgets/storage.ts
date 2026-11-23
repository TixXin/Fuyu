import { readJson, writeJson } from "../../lib/storage";
import { parseDaily, serializeDaily, type DailyData } from "./dailyFormat.ts";

export const DAILY_WIDGETS_KEY = "fuyu-daily-widgets";
export const KEEP_DAILY_DAYS = 70;

export function readDaily(): DailyData {
  return parseDaily(readJson(DAILY_WIDGETS_KEY));
}

export function writeDaily(data: DailyData, oldest: string): void {
  writeJson(DAILY_WIDGETS_KEY, serializeDaily(data, oldest));
}
