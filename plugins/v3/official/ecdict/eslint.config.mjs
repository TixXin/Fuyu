import tseslint from "typescript-eslint";

const TIMERS = ["setTimeout", "setInterval", "setImmediate"];
const GLOBALS = ["window", "globalThis", "self"];

const timer = "Use ctx.setTimeout, ctx.setInterval or ctx.sleep in the host part: they stop with the plugin.";
const listener = "Listeners added with addEventListener outlive the plugin.";

export default tseslint.config(
  { ignores: ["build/**", "dist/**", "node_modules/**"] },
  {
    files: ["**/*.{ts,tsx,mts,js,jsx,mjs}"],
    extends: [tseslint.configs.recommended],
    rules: {
      "no-restricted-globals": ["error", ...TIMERS.map((name) => ({ name, message: timer }))],
      "no-restricted-properties": [
        "error",
        ...GLOBALS.flatMap((object) => TIMERS.map((property) => ({ object, property, message: timer }))),
        { property: "addEventListener", message: listener },
      ],
    },
  },
);
