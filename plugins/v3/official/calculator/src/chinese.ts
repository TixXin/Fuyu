const UPPER_DIGITS = "零壹贰叁肆伍陆柒捌玖";
const LOWER_DIGITS = "零一二三四五六七八九";
const UPPER_SMALL = ["", "拾", "佰", "仟"];
const LOWER_SMALL = ["", "十", "百", "千"];
const BIG = ["", "万", "亿", "万亿", "亿亿"];

export const MAX_INTEGER_DIGITS = 20;

interface Split {
  negative: boolean;
  integer: string;
  fraction: string;
}

export function splitDecimal(input: string): Split | null {
  const cleaned = input.replace(/[,，\s_]/g, "").replace(/。/g, ".");
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (!match[2] && !match[3])) return null;
  const integer = (match[2] || "0").replace(/^0+(?=\d)/, "");
  if (integer.length > MAX_INTEGER_DIGITS) return null;
  return { negative: match[1] === "-", integer, fraction: match[3] ?? "" };
}

function groupText(group: string, digits: string, small: string[]): string {
  let out = "";
  let pendingZero = false;
  const padded = group.padStart(4, "0");
  for (let i = 0; i < 4; i += 1) {
    const digit = Number(padded[i]);
    if (digit === 0) {
      pendingZero = out.length > 0;
      continue;
    }
    if (pendingZero) out += digits[0];
    pendingZero = false;
    out += digits[digit] + small[3 - i];
  }
  return out;
}

function integerText(integer: string, digits: string, small: string[]): string {
  if (/^0*$/.test(integer)) return digits[0];
  const groups: string[] = [];
  for (let end = integer.length; end > 0; end -= 4) groups.unshift(integer.slice(Math.max(0, end - 4), end));
  let out = "";
  let zeroGap = false;
  groups.forEach((group, index) => {
    const unit = BIG[groups.length - 1 - index];
    if (/^0+$/.test(group)) {
      zeroGap = out.length > 0;
      return;
    }
    const needsZero = out.length > 0 && (zeroGap || group.padStart(4, "0")[0] === "0");
    out += (needsZero ? digits[0] : "") + groupText(group, digits, small) + unit;
    zeroGap = false;
  });
  return out;
}

export function toRmbUpper(input: string): string | null {
  const split = splitDecimal(input);
  if (!split) return null;
  const cents = Math.round(Number(`0.${split.fraction || "0"}`) * 100);
  let integer = split.integer;
  if (cents >= 100) integer = (BigInt(integer) + 1n).toString();
  const jiao = Math.floor((cents % 100) / 10);
  const fen = cents % 10;
  const hasInteger = !/^0+$/.test(integer);
  let out = hasInteger ? `${integerText(integer, UPPER_DIGITS, UPPER_SMALL)}元` : "";
  if (jiao === 0 && fen === 0) out = `${out || "零元"}整`;
  else {
    if (jiao > 0) out += `${UPPER_DIGITS[jiao]}角`;
    else if (hasInteger) out += "零";
    if (fen > 0) out += `${UPPER_DIGITS[fen]}分`;
    else out += "整";
  }
  return (split.negative ? "负" : "") + out;
}

function numberText(input: string, digits: string, small: string[], trimTen: boolean): string | null {
  const split = splitDecimal(input);
  if (!split) return null;
  let out = integerText(split.integer, digits, small);
  if (trimTen && out.startsWith(`${digits[1]}${small[1]}`)) out = out.slice(1);
  const fraction = split.fraction.replace(/0+$/, "");
  if (fraction) out += `点${[...fraction].map((digit) => digits[Number(digit)]).join("")}`;
  return (split.negative ? "负" : "") + out;
}

export function toChineseLower(input: string): string | null {
  return numberText(input, LOWER_DIGITS, LOWER_SMALL, true);
}

export function toChineseUpper(input: string): string | null {
  return numberText(input, UPPER_DIGITS, UPPER_SMALL, false);
}

export function toChineseDigits(input: string): string | null {
  const split = splitDecimal(input);
  if (!split) return null;
  const fraction = split.fraction ? `点${[...split.fraction].map((d) => "〇一二三四五六七八九"[Number(d)]).join("")}` : "";
  return (split.negative ? "负" : "") + [...split.integer].map((d) => "〇一二三四五六七八九"[Number(d)]).join("") + fraction;
}
