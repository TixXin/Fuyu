const HANDOFF_KEY = "fuyu-translation-handoff";
const HANDOFF_OPEN_MS = 5_000;
const HANDOFF_MAX_AGE_MS = 60_000;

type TranslationHandoff = {
  source: string;
  output: string;
  requestedAt: number;
  openRequestedAt: number | null;
};

function readHandoff(): TranslationHandoff | null {
  try {
    const value = JSON.parse(localStorage.getItem(HANDOFF_KEY) ?? "null") as Partial<TranslationHandoff> | null;
    if (!value || typeof value.source !== "string" || typeof value.output !== "string") return null;
    if (typeof value.requestedAt !== "number") return null;
    return {
      source: value.source,
      output: value.output,
      requestedAt: value.requestedAt,
      openRequestedAt: typeof value.openRequestedAt === "number" ? value.openRequestedAt : null,
    };
  } catch {
    return null;
  }
}

function writeHandoff(handoff: TranslationHandoff) {
  localStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
}

export function saveTranslationHandoff(source: string, output: string) {
  writeHandoff({
    source,
    output,
    requestedAt: Date.now(),
    openRequestedAt: readHandoff()?.openRequestedAt ?? null,
  });
}

export function requestTranslationHandoffOpen() {
  const current = readHandoff();
  if (!current) return;
  writeHandoff({ ...current, openRequestedAt: Date.now() });
}

export function takeTranslationHandoff(now = Date.now()): { source: string; output: string } | null {
  const current = readHandoff();
  if (!current?.openRequestedAt) return null;
  const openAge = now - current.openRequestedAt;
  const age = now - current.requestedAt;
  if (openAge > HANDOFF_OPEN_MS || age > HANDOFF_MAX_AGE_MS || openAge < 0 || age < 0) return null;
  writeHandoff({ ...current, openRequestedAt: null });
  return { source: current.source, output: current.output };
}
