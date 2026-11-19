import type { NetworkReading } from "../protocol.ts";

export interface ByteCounters {
  at: number;
  received: number;
  sent: number;
}

export function networkRate(prev: ByteCounters | null, next: ByteCounters): NetworkReading | null {
  if (!prev) return null;
  const seconds = Math.max(0.2, (next.at - prev.at) / 1000);
  return {
    downBytesPerSec: Math.max(0, Math.round((next.received - prev.received) / seconds)),
    upBytesPerSec: Math.max(0, Math.round((next.sent - prev.sent) / seconds)),
  };
}

export class NetworkMeter {
  private prev: ByteCounters | null = null;

  next(counters: ByteCounters): NetworkReading | null {
    const rate = networkRate(this.prev, counters);
    this.prev = counters;
    return rate;
  }

  reset(): void {
    this.prev = null;
  }
}
