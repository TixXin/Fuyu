const QQ_DOMAINS = new Set(["qq.com", "foxmail.com", "vip.qq.com"]);

function domainOf(email: string | null | undefined): string | null {
  const domain = email?.trim().toLowerCase().split("@")[1];
  return domain && /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(domain) ? domain : null;
}

export function mailWebUrl(email: string | null | undefined): string {
  const domain = domainOf(email);
  if (!domain || QQ_DOMAINS.has(domain)) return "https://mail.qq.com/";
  return `https://mail.${domain}/`;
}

export function hasQQMailHelp(email: string | null | undefined): boolean {
  const domain = domainOf(email);
  return domain === null || QQ_DOMAINS.has(domain);
}
