import assert from "node:assert/strict";
import test from "node:test";
import { ISLAND_OUTLINE_STYLE } from "../../src/windows/island/islandOutline.ts";

const EDGES = ["top", "bottom", "left", "right"];

const balanced = (text) => {
  let depth = 0;
  for (const char of text) {
    depth += char === "(" ? 1 : char === ")" ? -1 : 0;
    if (depth < 0) return false;
  }
  return depth === 0;
};

test("every edge has a fillet region, a rim ring and a body outline, plus the free pill ring", () => {
  const expected = [...EDGES.flatMap((edge) => [`--island-outline-fillets-${edge}`, `--island-outline-rim-${edge}`, `--island-outline-body-${edge}`]), "--island-outline-rim-free"];
  assert.deepEqual(Object.keys(ISLAND_OUTLINE_STYLE).sort(), expected.sort());
  for (const [name, value] of Object.entries(ISLAND_OUTLINE_STYLE)) {
    assert.match(value, /^shape\(/, name);
    assert.ok(balanced(value), `${name} has unbalanced parentheses`);
  }
});

test("rims are an outer and an inner path cut out with evenodd", () => {
  for (const name of [...EDGES.map((edge) => `--island-outline-rim-${edge}`), "--island-outline-rim-free"]) {
    const value = ISLAND_OUTLINE_STYLE[name];
    assert.match(value, /^shape\(evenodd from /, name);
    assert.equal(value.split("move to").length - 1, 1, name);
  }
});

const xs = (shape, { width, fillet }) => {
  const value = (expression) => {
    const numeric = expression
      .replaceAll("var(--island-top-fillet)", String(fillet))
      .replaceAll(/var\(--island-corner-k, ([\d.]+)\)/g, "$1")
      .replaceAll(/var\(--island-rim-width, ([\d.]+)px\)/g, "$1")
      .replaceAll(/var\(--island-shell-(top|bottom)-corner\)/g, "16")
      .replaceAll("100%", String(width))
      .replaceAll("px", "")
      .replaceAll("calc", "");
    assert.match(numeric, /^[\d.+\-*/() ]+$/, expression);
    return Function(`return ${numeric}`)();
  };
  const firstCalc = (start) => {
    let depth = 0;
    for (let index = start; index < shape.length; index += 1) {
      depth += shape[index] === "(" ? 1 : shape[index] === ")" ? -1 : 0;
      if (depth === 0 && shape[index] === ")") return shape.slice(start, index + 1);
    }
    throw new Error(`unbalanced at ${start}`);
  };
  const starts = [...shape.matchAll(/(?:from|to|with|\/) (?=calc\()/g)].map((match) => match.index + match[0].length);
  assert.ok(starts.length > 10, "no points parsed");
  return starts.map((start) => value(firstCalc(start)));
};

test("the free pill rim stays on the island body inside the ::after box that is widened by a fillet on each side", () => {
  const width = 400;
  const fillet = 14;
  const box = width + 2 * fillet;
  const all = xs(ISLAND_OUTLINE_STYLE["--island-outline-rim-free"], { width: box, fillet });
  assert.ok(Math.abs(Math.min(...all) - fillet) < 0.01, `leftmost x ${Math.min(...all)} should be ${fillet}`);
  assert.ok(Math.abs(Math.max(...all) - (box - fillet)) < 0.01, `rightmost x ${Math.max(...all)} should be ${box - fillet}`);
});

test("fillets bend into the screen edge: ccw on top and right, cw on the mirrored bottom and left", () => {
  const sweep = { top: "ccw", right: "ccw", bottom: "cw", left: "cw" };
  for (const edge of EDGES) {
    for (const kind of ["fillets", "rim", "body"]) {
      const arcs = [...ISLAND_OUTLINE_STYLE[`--island-outline-${kind}-${edge}`].matchAll(/arc to .*? (cw|ccw)\b/g)].map((match) => match[1]);
      assert.ok(arcs.length > 0, `${kind}-${edge} has no arcs`);
      assert.ok(arcs.every((value) => value === sweep[edge]), `${kind}-${edge}: ${arcs.join(",")}`);
    }
  }
});
