export function clockText(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function sizeText(bytes, ms) {
  const megabytes = bytes / 1e6;
  return `${megabytes.toFixed(1)} MB in ${clockText(ms)} (${(megabytes / Math.max(ms / 1000, 0.001)).toFixed(1)} MB/s)`;
}

export function stageTable(stages, totalMs) {
  if (stages.length === 0) return [];
  const width = Math.max(5, ...stages.map(({ stage }) => stage.length));
  const row = (name, ms) => `  ${name.padEnd(width)}  ${clockText(ms).padStart(6)}`;
  return ["", "Time per stage:", ...stages.map(({ stage, ms }) => row(stage, ms)), row("total", totalMs)];
}

export function createClock({ now = Date.now, log = console.log } = {}) {
  const start = now();
  let last = start;
  const stages = [];
  const close = (stage, message) => {
    const at = now();
    stages.push({ stage, ms: at - last, ...(message ? { message } : {}) });
    last = at;
    return at - start;
  };
  return {
    stamp: () => `[+${clockText(now() - start)}]`,
    done(stage, message) {
      log(`✓ [+${clockText(close(stage, message))}] ${message}`);
    },
    mark(stage) {
      close(stage);
    },
    stages: () => stages.map((entry) => ({ ...entry })),
    table: () => stageTable(stages, now() - start),
  };
}

export const releaseClock = createClock();
