import { normalizeMailAccounts, type MailAccountSettings } from "./mailAccounts.ts";

export const SETTINGS_KEY = "fuyu-qq-mail-settings";
export const REMOTE_IMAGES_KEY = "fuyu-qq-mail-remote-images";

export function loadMailAccounts(): MailAccountSettings[] {
  try {
    return normalizeMailAccounts(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"));
  } catch { return []; }
}

export function saveMailAccounts(accounts: MailAccountSettings[]) {
  if (accounts.length === 0) {
    localStorage.removeItem(SETTINGS_KEY);
    return;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    accounts: accounts.map(({ email, host, enabled }) => ({ email, host, enabled })),
  }));
}

export function loadRemoteImagePreference() {
  try { return localStorage.getItem(REMOTE_IMAGES_KEY) === "true"; } catch { return false; }
}

export function saveRemoteImagePreference(allow: boolean) {
  try { localStorage.setItem(REMOTE_IMAGES_KEY, String(allow)); } catch {}
}
