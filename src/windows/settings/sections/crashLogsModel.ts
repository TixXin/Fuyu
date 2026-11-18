export function crashLogFileName(crashLog: string | null | undefined): string | null {
  const trimmed = crashLog?.trim().replace(/[\\/]+$/, "") ?? "";
  if (!trimmed) return null;
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || null;
}

export function crashLogTarget(home: string, crashLog: string | null | undefined): {
  path: string;
  hasLog: boolean;
  fileName: string | null;
} {
  const fileName = crashLogFileName(crashLog);
  if (fileName && crashLog) {
    return { path: crashLog.trim(), hasLog: true, fileName };
  }
  return { path: home, hasLog: false, fileName: null };
}
