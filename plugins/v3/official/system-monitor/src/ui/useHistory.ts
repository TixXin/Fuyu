import type { Context } from "@fuyu/plugin-base";
import { useEffect, useMemo, useState } from "react";
import {
  HISTORY_LIMIT,
  HISTORY_WINDOW_MS,
  METHODS,
  historyPoint,
  type HistoryPoint,
  type MonitorHistory,
  type MonitorSample,
} from "../protocol.ts";

export interface HistorySeries {
  cpu: number[];
  gpu: number[];
  down: number[];
  up: number[];
}

export function mergePoints(base: readonly HistoryPoint[], extra: readonly HistoryPoint[]): HistoryPoint[] {
  const merged = [...base];
  for (const point of extra) {
    const last = merged[merged.length - 1];
    if (!last || point.at > last.at) merged.push(point);
  }
  const newest = merged[merged.length - 1]?.at ?? 0;
  const fresh = merged.filter((point) => point.at >= newest - HISTORY_WINDOW_MS);
  return fresh.length > HISTORY_LIMIT ? fresh.slice(fresh.length - HISTORY_LIMIT) : fresh;
}

export function toSeries(points: readonly HistoryPoint[]): HistorySeries {
  return {
    cpu: points.map((point) => point.cpu),
    gpu: points.map((point) => point.gpu ?? 0),
    down: points.map((point) => point.down ?? 0),
    up: points.map((point) => point.up ?? 0),
  };
}

export function useHistory(ctx: Context, sample: MonitorSample | null): HistorySeries {
  const [points, setPoints] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    let alive = true;
    ctx.host
      .call<MonitorHistory>(METHODS.getHistory)
      .then((history) => {
        if (!alive || !Array.isArray(history?.points)) return;
        setPoints((local) => mergePoints(history.points, local));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ctx]);

  useEffect(() => {
    if (!sample) return;
    setPoints((prev) => mergePoints(prev, [historyPoint(sample)]));
  }, [sample]);

  return useMemo(() => toSeries(points), [points]);
}
