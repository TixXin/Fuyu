const EFFORT_SHORT: Record<string, string> = { minimal: "Min", low: "L", medium: "M", high: "H", xhigh: "XH", max: "Max" };

export function shortEffort(effort: string) {
  const key = effort.trim().toLowerCase();
  return EFFORT_SHORT[key] ?? effort.trim();
}

export function pillParts(label: string | null, model: string | null) {
  if (!label) return { model: null, effort: null };
  if (model && label.startsWith(`${model} · `)) return { model, effort: shortEffort(label.slice(model.length + 3)) };
  if (model && label === model) return { model, effort: null };
  if (!model) return { model: null, effort: shortEffort(label) };
  return { model: label, effort: null };
}
