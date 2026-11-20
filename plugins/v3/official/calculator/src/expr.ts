type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: string }
  | { kind: "name"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" };

export class ExprError extends Error {}

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: (value: number, base?: number) => (base === undefined ? Math.log10(value) : Math.log(value) / Math.log(base)),
  lg: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  sin: (deg: number) => Math.sin((deg * Math.PI) / 180),
  cos: (deg: number) => Math.cos((deg * Math.PI) / 180),
  tan: (deg: number) => Math.tan((deg * Math.PI) / 180),
  asin: (value: number) => (Math.asin(value) * 180) / Math.PI,
  acos: (value: number) => (Math.acos(value) * 180) / Math.PI,
  atan: (value: number) => (Math.atan(value) * 180) / Math.PI,
  round: (value: number, digits = 0) => Math.round(value * 10 ** digits) / 10 ** digits,
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E };

const NORMALIZE: [RegExp, string][] = [
  [/[×＊✕·]/g, "*"],
  [/(\d)\s*[xX]\s*(?=[\d.(])/g, "$1*"],
  [/[÷／]/g, "/"],
  [/[＋]/g, "+"],
  [/[－−—]/g, "-"],
  [/（/g, "("],
  [/）/g, ")"],
  [/，/g, ","],
  [/。/g, "."],
  [/\*\*/g, "^"],
  [/√/g, "sqrt"],
];

function tokenize(input: string): Token[] {
  let text = input;
  for (const [pattern, replacement] of NORMALIZE) text = text.replace(pattern, replacement);
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const number = /^(\d[\d_]*\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(text.slice(index));
    if (number) {
      tokens.push({ kind: "num", value: Number(number[0].replace(/_/g, "")) });
      index += number[0].length;
      continue;
    }
    const name = /^[a-zπ][a-z0-9]*/i.exec(text.slice(index));
    if (name) {
      tokens.push({ kind: "name", value: name[0].toLowerCase() });
      index += name[0].length;
      continue;
    }
    if ("+-*/^%!".includes(char)) tokens.push({ kind: "op", value: char });
    else if (char === "(") tokens.push({ kind: "lparen" });
    else if (char === ")") tokens.push({ kind: "rparen" });
    else if (char === ",") tokens.push({ kind: "comma" });
    else throw new ExprError(`unexpected "${char}"`);
    index += 1;
  }
  return tokens;
}

function factorial(value: number): number {
  if (!Number.isInteger(value) || value < 0) throw new ExprError("factorial needs a whole number");
  if (value > 170) return Infinity;
  let result = 1;
  for (let n = 2; n <= value; n += 1) result *= n;
  return result;
}

class Parser {
  private index = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): number {
    if (this.tokens.length === 0) throw new ExprError("empty");
    const value = this.expression();
    if (this.index < this.tokens.length) throw new ExprError("unexpected token");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private isOp(value: string): boolean {
    const token = this.peek();
    return token?.kind === "op" && token.value === value;
  }

  private expression(): number {
    let value = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.tokens[this.index++] as { value: string }).value;
      const right = this.term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  private startsFactor(): boolean {
    const token = this.peek();
    return token?.kind === "num" || token?.kind === "name" || token?.kind === "lparen";
  }

  private term(): number {
    let value = this.unary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.tokens[this.index++] as { value: string }).value;
        const right = this.unary();
        value = op === "*" ? value * right : value / right;
      } else if (this.startsFactor()) {
        value *= this.unary();
      } else {
        return value;
      }
    }
  }

  private unary(): number {
    if (this.isOp("-")) {
      this.index += 1;
      return -this.unary();
    }
    if (this.isOp("+")) {
      this.index += 1;
      return this.unary();
    }
    return this.power();
  }

  private power(): number {
    const base = this.postfix();
    if (this.isOp("^")) {
      this.index += 1;
      return base ** this.unary();
    }
    return base;
  }

  private postfix(): number {
    let value = this.primary();
    for (;;) {
      if (this.isOp("%")) {
        this.index += 1;
        value /= 100;
      } else if (this.isOp("!")) {
        this.index += 1;
        value = factorial(value);
      } else {
        return value;
      }
    }
  }

  private expect(kind: "rparen") {
    if (this.peek()?.kind !== kind) throw new ExprError("missing )");
    this.index += 1;
  }

  private primary(): number {
    const token = this.peek();
    if (!token) throw new ExprError("incomplete");
    this.index += 1;
    if (token.kind === "num") return token.value;
    if (token.kind === "lparen") {
      const value = this.expression();
      if (this.peek()) this.expect("rparen");
      return value;
    }
    if (token.kind === "name") {
      if (token.value in CONSTANTS) return CONSTANTS[token.value];
      const fn = FUNCTIONS[token.value];
      if (!fn) throw new ExprError(`unknown "${token.value}"`);
      if (this.peek()?.kind !== "lparen") return fn(this.power());
      this.index += 1;
      const args = [this.expression()];
      while (this.peek()?.kind === "comma") {
        this.index += 1;
        args.push(this.expression());
      }
      if (this.peek()) this.expect("rparen");
      return fn(...args);
    }
    throw new ExprError("unexpected token");
  }
}

export function evaluate(input: string): number {
  return new Parser(tokenize(input)).parse();
}

export function tryEvaluate(input: string): number | null {
  try {
    const value = evaluate(input);
    return Number.isNaN(value) ? null : value;
  } catch {
    return null;
  }
}
