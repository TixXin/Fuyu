import { htmlToPlainText } from "./messageCopy.ts";

const MAX_SCAN_CHARS = 12_000;
const MAX_TRIGGER_DISTANCE = 80;

const TECH_TOKENS = new Set([
  "2FA", "MFA", "UTF8", "SHA1", "SHA256", "SHA512", "BASE64", "HTML5", "CSS3",
  "HTTP2", "HTTP3", "IPV4", "IPV6", "POP3", "IMAP4", "SMTP", "TLS12", "TLS13",
  "OAUTH2", "WEB3", "ARM64", "WIN10", "WIN11", "H264", "H265",
]);

const DISTRACTION_PATTERNS: readonly RegExp[] = [
  /https?:\/\/\S+|www\.\S+/gi,
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,
  /\b(?:error|exit|status|http|postal|zip|area|promo|discount|coupon|invite|referral|qr|source|country|currency)\s+codes?\b/gi,
  /邮政编码|错误码|状态码|优惠码|折扣码|邀请码|推荐码/g,
  /\b\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?\b|\d{4}年\d{1,2}月(?:\d{1,2}日)?/g,
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
  /\b[48]00[- ]?\d{3}[- ]?\d{4}\b|(?<![A-Za-z0-9])(?:\+?86[- ]?)?1[3-9]\d{9}(?![A-Za-z0-9])/g,
  /(?:[¥￥$€£]|(?:RMB|USD|CNY|HKD|EUR)\b)\s*\d+(?:[.,]\d+)?|\b\d+\.\d+\b/gi,
  /\d+\s*(?:元|块|美元|分钟|小时|秒钟?|天|周|个月|年|月|日|号|个|条|封|次|位|折|GB|MB|KB|TB|%)/gi,
];

const TRIGGER_PATTERNS: readonly RegExp[] = [
  /验证码|校验码|动态码|安全代码|安全码|确认码|识别码|通行码|登录码|登陆码|授权码|一次性密码|一次性代码|短信密码|邮件密码/g,
  /\b(?:verification|security|confirmation|authentication|login|sign-?in|access|auth|verify|temporary|single-use|one-time|one\s+time|2fa|mfa|totp|otp|pin)\s+(?:code|password|passcode|pin)\b/gi,
  /\b(?:passcode|otp)\b/gi,
  /\byour\s+(?:[a-z0-9-]{2,20}\s+)?code(?:\s+is|\s*[:：])/gi,
  /\bcode\s*[:：]/gi,
];

const CLUE_PATTERN = /验证|校验|动态码|安全码|安全代码|确认码|通行码|登录|登陆|授权|绑定|一次性|口令|重置密码|找回密码|\b(?:verify|verification|security|passcode|one-time|otp|2fa|mfa|sign-?in|log-?in|auth|authentication|confirm|confirmation)\b/i;

type Span = { start: number; end: number };
type Candidate = { code: string; start: number; end: number };

function maskDistractions(text: string): string {
  let masked = text;
  for (const pattern of DISTRACTION_PATTERNS) {
    masked = masked.replace(pattern, (match) => " ".repeat(match.length));
  }
  return masked;
}

function findTriggerSpans(text: string): Span[] {
  const spans: Span[] = [];
  for (const pattern of TRIGGER_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      spans.push({ start, end: start + match[0].length });
    }
  }
  return spans;
}

function collectCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];
  const occupied = (start: number, end: number) =>
    candidates.some((item) => start < item.end && end > item.start);

  for (const match of text.matchAll(/(?<![A-Za-z0-9])G-(\d{6})(?![A-Za-z0-9])/g)) {
    const start = match.index ?? 0;
    candidates.push({ code: match[1], start, end: start + match[0].length });
  }

  for (const match of text.matchAll(/(?<![A-Za-z0-9])(\d{3})[- ](\d{3})(?![A-Za-z0-9])|(?<![A-Za-z0-9])(\d{4})[- ](\d{4})(?![A-Za-z0-9])/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (occupied(start, end)) continue;
    const code = match[1] ? `${match[1]}${match[2]}` : `${match[3]}${match[4]}`;
    candidates.push({ code, start, end });
  }

  for (const match of text.matchAll(/(?<![A-Za-z0-9])([A-Z0-9]{4,8})(?![A-Za-z0-9])/g)) {
    const raw = match[1];
    const start = match.index ?? 0;
    const end = start + raw.length;
    if (occupied(start, end)) continue;
    if (!/\d/.test(raw) || TECH_TOKENS.has(raw)) continue;
    candidates.push({ code: raw, start, end });
  }

  return candidates;
}

function isLikelyYear(code: string): boolean {
  if (!/^\d{4}$/.test(code)) return false;
  const value = Number(code);
  return value >= 1990 && value <= 2099;
}

function extractFromPlainText(raw: string): string | null {
  const clipped = raw.slice(0, MAX_SCAN_CHARS);
  if (!clipped.trim()) return null;
  const masked = maskDistractions(clipped);
  const triggers = findTriggerSpans(masked);
  if (triggers.length === 0) return null;
  const candidates = collectCandidates(masked);
  if (candidates.length === 0) return null;

  let bestCode: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    for (const trigger of triggers) {
      const before = candidate.end <= trigger.start;
      const distance = candidate.start >= trigger.end
        ? candidate.start - trigger.end
        : before
          ? trigger.start - candidate.end
          : 0;
      if (distance > MAX_TRIGGER_DISTANCE) continue;
      if (isLikelyYear(candidate.code) && distance > 16) continue;
      const score = distance + (before ? 6 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestCode = candidate.code;
      }
    }
  }

  return bestCode;
}

export function extractVerificationCode(
  subject: string,
  body = "",
  contentType: "text/plain" | "text/html" = "text/plain",
): string | null {
  const subjectCode = extractFromPlainText(subject);
  if (subjectCode) return subjectCode;
  if (!body) return null;
  const plainBody = contentType === "text/html"
    ? htmlToPlainText(body.slice(0, MAX_SCAN_CHARS * 4))
    : body.slice(0, MAX_SCAN_CHARS);
  if (!plainBody) return null;
  return extractFromPlainText(`${subject}\n${plainBody}`);
}

export function hasVerificationClue(subject: string, sender = ""): boolean {
  return CLUE_PATTERN.test(subject) || CLUE_PATTERN.test(sender);
}

export const OTP_ACTION_PREFIX = "copy-otp:";

export function otpActionId(code: string): string {
  return `${OTP_ACTION_PREFIX}${code}`;
}

export function parseOtpAction(actionId: string): string | null {
  return actionId.startsWith(OTP_ACTION_PREFIX) ? actionId.slice(OTP_ACTION_PREFIX.length) || null : null;
}
