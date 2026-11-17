import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MOTION_BASE_MS,
  MOTION_CSS_BLOCK,
  MOTION_CSS_VARIABLES,
  MOTION_EASE,
  MOTION_EASE_IN_OUT,
  MOTION_EASE_OUT,
  MOTION_FAST_MS,
  MOTION_MEDIUM_MS,
  MOTION_SLOW_MS,
} from "../../src/lib/theme/motionTokens.ts";

const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("tokens.css embeds the generated motion token block from motionTokens.ts", () => {
  assert.ok(css.includes(`\n${MOTION_CSS_BLOCK}\n`), "tokens.css :root block matches MOTION_CSS_BLOCK");
  const defined = [...css.matchAll(/(--motion-[\w-]+):/g)].map((match) => match[1]);
  assert.deepEqual(defined, Object.keys(MOTION_CSS_VARIABLES));
});

test("motionTokens.ts exports the curves and durations in MOTION_CSS_VARIABLES", () => {
  assert.deepEqual(MOTION_CSS_VARIABLES, {
    "--motion-ease": MOTION_EASE,
    "--motion-ease-out": MOTION_EASE_OUT,
    "--motion-ease-in-out": MOTION_EASE_IN_OUT,
    "--motion-fast": `${MOTION_FAST_MS}ms`,
    "--motion-base": `${MOTION_BASE_MS}ms`,
    "--motion-medium": `${MOTION_MEDIUM_MS}ms`,
    "--motion-slow": `${MOTION_SLOW_MS}ms`,
  });
});
