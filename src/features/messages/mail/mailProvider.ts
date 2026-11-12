export type MailProvider = "qq" | "netease" | "gmail" | "outlook";

const PROVIDER_DOMAINS: Record<string, MailProvider> = {
  "qq.com": "qq",
  "vip.qq.com": "qq",
  "foxmail.com": "qq",
  "163.com": "netease",
  "vip.163.com": "netease",
  "126.com": "netease",
  "vip.126.com": "netease",
  "yeah.net": "netease",
  "188.com": "netease",
  "gmail.com": "gmail",
  "googlemail.com": "gmail",
  "msn.com": "outlook",
};

const OUTLOOK_DOMAIN = /^(outlook|hotmail|live)\.[a-z.]+$/;

export function mailProviderOf(email: string | null | undefined): MailProvider | null {
  const domain = email?.trim().toLowerCase().split("@")[1];
  if (!domain) return null;
  return PROVIDER_DOMAINS[domain] ?? (OUTLOOK_DOMAIN.test(domain) ? "outlook" : null);
}

export function sharedMailProvider(emails: readonly (string | null | undefined)[]): MailProvider | null {
  const providers = new Set(emails.filter(Boolean).map(mailProviderOf));
  if (providers.size !== 1) return null;
  const [only] = providers;
  return only ?? null;
}
