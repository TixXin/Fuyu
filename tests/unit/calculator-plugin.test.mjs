import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { bmiLevel, bmiOf, healthyRange } from "../../plugins/v3/official/calculator/src/bmi.ts";
import { toChineseDigits, toChineseLower, toChineseUpper, toRmbUpper } from "../../plugins/v3/official/calculator/src/chinese.ts";
import { convertCurrency, parseRatesResponse } from "../../plugins/v3/official/calculator/src/currency.ts";
import { addMonths, addWorkdays, dateSpan, formatDate, parseDate } from "../../plugins/v3/official/calculator/src/dates.ts";
import { tryEvaluate } from "../../plugins/v3/official/calculator/src/expr.ts";
import { formatNumber, parseNumber } from "../../plugins/v3/official/calculator/src/format.ts";
import { reverseChain, solve } from "../../plugins/v3/official/calculator/src/kinship.ts";
import { describeChain, lookupTitle } from "../../plugins/v3/official/calculator/src/kinshipTitles.ts";
import { annuity, combinedLoan, equalPrincipal } from "../../plugins/v3/official/calculator/src/loan.ts";
import { mergePrefs, normalizePrefs, pushHistory } from "../../plugins/v3/official/calculator/src/model.ts";
import { formatInBase, parseInBase } from "../../plugins/v3/official/calculator/src/radix.ts";
import { bonusTax, salaryTax } from "../../plugins/v3/official/calculator/src/tax.ts";
import { UNITS, convertUnit } from "../../plugins/v3/official/calculator/src/units.ts";

const near = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected}`);

test("C149 expressions: precedence, implicit multiply, percent, functions", () => {
  assert.equal(tryEvaluate("1+2*3"), 7);
  assert.equal(tryEvaluate("(1+2)×3"), 9);
  assert.equal(tryEvaluate("2^3^2"), 512);
  assert.equal(tryEvaluate("-2^2"), -4);
  assert.equal(tryEvaluate("50%"), 0.5);
  assert.equal(tryEvaluate("2(3+4)"), 14);
  assert.equal(tryEvaluate("3 x 4"), 12);
  assert.equal(tryEvaluate("5!"), 120);
  assert.equal(tryEvaluate("max(3, 9, 4)"), 9);
  assert.equal(tryEvaluate("sqrt(16)"), 4);
  near(tryEvaluate("sin(30)"), 0.5);
  near(tryEvaluate("2pi"), 2 * Math.PI);
  assert.equal(tryEvaluate("12÷4"), 3);
  assert.equal(tryEvaluate("（1+1）"), 2);
  assert.equal(tryEvaluate("1+"), null);
  assert.equal(tryEvaluate("foo(1)"), null);
  assert.equal(tryEvaluate(""), null);
});

test("C149 number formatting", () => {
  assert.equal(formatNumber(1234567.891), "1,234,567.891");
  assert.equal(formatNumber(0.1 + 0.2), "0.3");
  assert.equal(formatNumber(1e20), "1e20");
  assert.equal(parseNumber("1,234.5"), 1234.5);
  assert.equal(parseNumber("abc"), null);
});

test("C149 unit conversion", () => {
  assert.equal(convertUnit("length", 1, "km", "m"), 1000);
  near(convertUnit("length", 1, "in", "cm"), 2.54);
  near(convertUnit("weight", 1, "jin", "kg"), 0.5);
  near(convertUnit("area", 1, "mu", "m2"), 666.6666667, 1e-6);
  near(convertUnit("area", 1, "qing", "mu"), 100);
  near(convertUnit("temperature", 100, "c", "f"), 212);
  near(convertUnit("temperature", 0, "k", "c"), -273.15);
  near(convertUnit("speed", 36, "kmh", "mps"), 10);
  assert.equal(convertUnit("data", 1, "GiB", "MiB"), 1024);
  assert.equal(convertUnit("time", 2, "h", "min"), 120);
  for (const [category, units] of Object.entries(UNITS)) {
    for (const unit of units) near(convertUnit(category, convertUnit(category, 3.5, unit.id, units[0].id), units[0].id, unit.id), 3.5, 1e-9);
  }
});

test("C149 currency", () => {
  const parsed = parseRatesResponse({ result: "success", time_last_update_unix: 1_700_000_000, rates: { USD: 1, CNY: 7.2, EUR: 0.9, bad: "x" } });
  assert.deepEqual(parsed, { rates: { USD: 1, CNY: 7.2, EUR: 0.9 }, updatedAt: 1_700_000_000_000 });
  assert.equal(parseRatesResponse({ result: "error" }), null);
  near(convertCurrency(parsed.rates, 72, "CNY", "USD"), 10);
  near(convertCurrency(parsed.rates, 9, "EUR", "CNY"), 72);
  assert.equal(convertCurrency(parsed.rates, 1, "CNY", "JPY"), null);
});

test("C149 Chinese numerals and RMB in words", () => {
  assert.equal(toRmbUpper("0"), "零元整");
  assert.equal(toRmbUpper("1234.56"), "壹仟贰佰叁拾肆元伍角陆分");
  assert.equal(toRmbUpper("1000.05"), "壹仟元零伍分");
  assert.equal(toRmbUpper("100000"), "壹拾万元整");
  assert.equal(toRmbUpper("10010"), "壹万零壹拾元整");
  assert.equal(toRmbUpper("100000001"), "壹亿零壹元整");
  assert.equal(toRmbUpper("0.5"), "伍角整");
  assert.equal(toRmbUpper("12.3"), "壹拾贰元叁角整");
  assert.equal(toRmbUpper("-8"), "负捌元整");
  assert.equal(toRmbUpper("1.999"), "贰元整");
  assert.equal(toChineseLower("12"), "十二");
  assert.equal(toChineseLower("105"), "一百零五");
  assert.equal(toChineseLower("3.14"), "三点一四");
  assert.equal(toChineseUpper("2024"), "贰仟零贰拾肆");
  assert.equal(toChineseDigits("2026"), "二〇二六");
  assert.equal(toRmbUpper("abc"), null);
});

test("C149 number bases", () => {
  assert.equal(parseInBase("ff", 16), 255n);
  assert.equal(parseInBase("0b1010", 2), 10n);
  assert.equal(parseInBase("12", 2), null);
  assert.equal(formatInBase(255n, 2), "11111111");
  assert.equal(formatInBase(255n, 16), "FF");
  assert.equal(formatInBase(-35n, 36), "-Z");
  assert.equal(formatInBase(parseInBase("123456789012345678901234567890", 10), 16), "18EE90FF6C373E0EE4E3F0AD2");
});

test("C149 dates", () => {
  const a = parseDate("2026-01-01");
  const b = parseDate("2026-03-01");
  assert.equal(parseDate("2026-02-30"), null);
  const span = dateSpan(a, b);
  assert.equal(span.days, 59);
  assert.equal(span.months, 2);
  assert.equal(span.monthDays, 0);
  assert.equal(dateSpan(b, a).days, -59);
  assert.equal(dateSpan(parseDate("2026-11-16"), parseDate("2026-11-23")).workdays, 5);
  assert.equal(formatDate(addMonths(parseDate("2026-01-31"), 1)), "2026-02-28");
  assert.equal(formatDate(addWorkdays(parseDate("2026-11-20"), 1)), "2026-11-23");
  assert.equal(formatDate(addWorkdays(parseDate("2026-11-23"), -1)), "2026-11-20");
});

test("C149 income tax: cumulative withholding and bonus", () => {
  const result = salaryTax({ salary: 25_000, insurance: 5_625, special: 2_000, bonus: 60_000 });
  assert.equal(result.months[0].tax, 371.25);
  assert.equal(result.months[2].tax, 450);
  assert.equal(result.months[3].tax, 1237.5);
  assert.equal(result.salaryTax, 12_780);
  assert.equal(bonusTax(60_000), 5_790);
  assert.equal(bonusTax(36_000), 1_080);
  assert.equal(result.bonusBest, "separate");
  assert.equal(result.totalTax, 18_570);
  const low = salaryTax({ salary: 5_000, insurance: 0, special: 0, bonus: 0 });
  assert.equal(low.totalTax, 0);
});

test("C149 mortgage", () => {
  const level = annuity(1_000_000, 4.9, 360);
  near(level.firstPayment, 5307.27, 0.01);
  const principal = equalPrincipal(1_000_000, 4.9, 360);
  near(principal.firstPayment, 6861.11, 0.01);
  near(principal.totalInterest, 737_041.67, 0.01);
  const zero = annuity(120_000, 0, 120);
  assert.equal(zero.firstPayment, 1000);
  const combo = combinedLoan([{ amount: 1_000_000, rate: 4.9 }, { amount: 500_000, rate: 3.1 }], 30, "annuity");
  near(combo.firstPayment, level.firstPayment + annuity(500_000, 3.1, 360).firstPayment);
});

test("C149 kinship terms, both ways", () => {
  const zh = (chain, self) => solve(chain, self, (key) => lookupTitle(key, "zh-CN"), (c) => describeChain(c, "zh-CN")).titles;
  assert.deepEqual(zh(["f", "m"], "male"), ["奶奶"]);
  assert.deepEqual(zh(["m", "ob", "w"], "male"), ["舅妈"]);
  assert.deepEqual(zh(["f", "ob", "s"], "female"), ["堂哥", "堂弟"]);
  assert.deepEqual(zh(["f", "s"], "male").sort(), ["哥哥", "弟弟", "自己"].sort());
  assert.deepEqual(zh(["f", "s"], "female").sort(), ["哥哥", "弟弟"].sort());
  assert.deepEqual(zh(["m", "h"], "male"), ["爸爸"]);
  assert.deepEqual(zh(["w", "f"], "male"), ["岳父"]);
  assert.deepEqual(zh(["s", "w", "m"], "male"), ["亲家母"]);
  assert.deepEqual(zh(["ob", "f"], "female"), ["爸爸"]);
  const back = reverseChain(["f", "m"], "female");
  assert.deepEqual(back, { chain: ["s", "d"], self: "female" });
  assert.deepEqual(zh(back.chain, back.self), ["孙女"]);
  const aunt = reverseChain(["m", "os"], "male");
  assert.deepEqual(zh(aunt.chain, aunt.self), ["外甥"]);
});

test("C149 BMI", () => {
  near(bmiOf(170, 65), 22.4913, 1e-4);
  assert.equal(bmiLevel(23.9, "cn"), "normal");
  assert.equal(bmiLevel(24.5, "cn"), "over");
  assert.equal(bmiLevel(24.5, "who"), "normal");
  assert.equal(bmiLevel(17, "who"), "under");
  const [low, high] = healthyRange(170, "cn");
  near(low, 53.465);
  near(high, 69.36);
  assert.equal(bmiOf(0, 60), null);
});

test("C149 prefs keep only known values", () => {
  const prefs = normalizePrefs({ tab: "nope", units: { length: "km", weight: "parsec" }, history: ["1+1 = 2", 3], fields: { "loan.years": "20", bad: 1 } });
  assert.equal(prefs.tab, "calc");
  assert.equal(prefs.units.length, "km");
  assert.equal(prefs.units.weight, "kg");
  assert.deepEqual(prefs.history, ["1+1 = 2"]);
  assert.deepEqual(prefs.fields, { "loan.years": "20" });
  const merged = mergePrefs(prefs, { tab: "tax", fields: { "tax.salary": "9000" } });
  assert.equal(merged.tab, "tax");
  assert.deepEqual(merged.fields, { "loan.years": "20", "tax.salary": "9000" });
  assert.deepEqual(pushHistory(["a", "b"], "b"), ["b", "a"]);
});

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/calculator", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-c149-calculator-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("C149 the calculator packs, installs and runs in startHost", async () => {
  const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, "built"), packDir: join(scratch, "packed") });
  assert.equal(packed.manifest.name, "@fuyu/calculator");
  assert.deepEqual(packed.manifest.fuyu.network, ["open.er-api.com"]);
  assert.deepEqual(packed.manifest.fuyu.commands.map((item) => item.id), ["open"]);
  const hostDir = join(scratch, "host");
  mkdirSync(hostDir, { recursive: true });
  installPackage(packed.file, { dir: hostDir, source: "market", official: true, expectedSha256: packed.sha256 });
  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  try {
    await host.settle();
    assert.equal(host.status().find((item) => item.id === "@fuyu/calculator")?.state, "running");
  } finally {
    await host.stop();
  }
});
