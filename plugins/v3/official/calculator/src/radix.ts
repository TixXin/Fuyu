const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export const COMMON_BASES = [2, 8, 10, 16] as const;

export function parseInBase(input: string, base: number): bigint | null {
  if (!Number.isInteger(base) || base < 2 || base > 36) return null;
  let text = input.trim().toLowerCase().replace(/[\s_,]/g, "");
  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  const prefix = base === 16 ? "0x" : base === 8 ? "0o" : base === 2 ? "0b" : "";
  if (prefix && text.startsWith(prefix)) text = text.slice(2);
  if (!text) return null;
  let value = 0n;
  const big = BigInt(base);
  for (const char of text) {
    const digit = DIGITS.indexOf(char);
    if (digit < 0 || digit >= base) return null;
    value = value * big + BigInt(digit);
  }
  return negative ? -value : value;
}

export function formatInBase(value: bigint, base: number): string {
  const text = (value < 0n ? -value : value).toString(base);
  const shown = base > 10 ? text.toUpperCase() : text;
  return value < 0n ? `-${shown}` : shown;
}

export function groupDigits(text: string, base: number): string {
  const size = base === 2 ? 4 : base === 10 ? 3 : base === 16 ? 4 : 0;
  if (!size) return text;
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const parts: string[] = [];
  for (let end = body.length; end > 0; end -= size) parts.unshift(body.slice(Math.max(0, end - size), end));
  return (negative ? "-" : "") + parts.join(base === 10 ? "," : " ");
}
