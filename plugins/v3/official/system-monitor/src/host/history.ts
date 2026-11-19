import { HISTORY_LIMIT, HISTORY_WINDOW_MS, type HistoryPoint, type MonitorHistory } from "../protocol.ts";

export class History {
  private points: HistoryPoint[] = [];
  private readonly windowMs: number;
  private readonly limit: number;

  constructor(windowMs = HISTORY_WINDOW_MS, limit = HISTORY_LIMIT) {
    this.windowMs = windowMs;
    this.limit = limit;
  }

  add(point: HistoryPoint): void {
    const last = this.points[this.points.length - 1];
    if (last && point.at <= last.at) return;
    this.points.push(point);
    this.trim(point.at);
  }

  clear(): void {
    this.points = [];
  }

  get size(): number {
    return this.points.length;
  }

  lastAt(): number {
    return this.points[this.points.length - 1]?.at ?? 0;
  }

  snapshot(now: number): MonitorHistory {
    this.trim(now);
    return { windowMs: this.windowMs, points: [...this.points] };
  }

  private trim(now: number): void {
    const from = now - this.windowMs;
    let drop = 0;
    while (drop < this.points.length && this.points[drop].at < from) drop += 1;
    const over = this.points.length - drop - this.limit;
    if (over > 0) drop += over;
    if (drop > 0) this.points = this.points.slice(drop);
  }
}
