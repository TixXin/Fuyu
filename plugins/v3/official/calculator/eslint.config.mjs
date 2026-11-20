import tseslint from "typescript-eslint";

const TIMERS = ["setTimeout", "setInterval", "setImmediate"];
const GLOBALS = ["window", "globalThis", "self"];

const timer = "Use ctx.setTimeout, ctx.setInterval or ctx.sleep in the host part: they stop with the plugin. Windows get updates from the host with ctx.host.on.";
const listener = "Listeners added with addEventListener outlive the plugin. Use ctx.host.on, a service's on(), or React's onClick and friends.";
const style = 'Import a .css file instead (import "./styles.css"): the build adds it while the plugin runs and takes it out when it stops.';

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
        { object: "document", property: "head", message: style },
        { property: "adoptedStyleSheets", message: style },
        { property: "insertRule", message: style },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.property.name='createElement'][arguments.0.value=/^(style|link)$/i]", message: style },
        { selector: "NewExpression[callee.name='CSSStyleSheet']", message: style },
      ],
    },
  },
);
