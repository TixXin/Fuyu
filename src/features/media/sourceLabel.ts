type Source = {
  sourceApp: string | null;
  activeSessionId: string | null;
  sessions: readonly { id: string; label: string }[];
};

const clean = (value: string | null | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

export function sourceLabel(state: Source, appName: string | null): string | null {
  const id = clean(state.activeSessionId) ?? clean(state.sourceApp);
  const session = state.sessions.find((item) => item.id === id) ?? state.sessions[0];
  const label = clean(session?.label);
  const known = label !== null && label !== id && label !== clean(session?.id);
  return known ? label : clean(appName) ?? label;
}
