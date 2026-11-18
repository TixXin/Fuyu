import type { WebdavSummary } from "./api";

export function normalizeDraftWebdavUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function canReuseSavedWebdavPassword(
  saved: WebdavSummary | null | undefined,
  draftUrl: string,
  draftUsername: string,
): boolean {
  if (!saved?.hasPassword) return false;
  const nextUrl = normalizeDraftWebdavUrl(draftUrl);
  const savedUrl = normalizeDraftWebdavUrl(saved.url);
  if (!nextUrl || nextUrl !== savedUrl) return false;
  const nextUser = draftUsername.trim();
  return Boolean(nextUser) && nextUser === saved.username.trim();
}

export function canSubmitWebdavForm(
  saved: WebdavSummary | null | undefined,
  draftUrl: string,
  draftUsername: string,
  draftPassword: string,
): boolean {
  if (!draftUrl.trim() || !draftUsername.trim()) return false;
  if (draftPassword.trim().length > 0) return true;
  return canReuseSavedWebdavPassword(saved, draftUrl, draftUsername);
}
