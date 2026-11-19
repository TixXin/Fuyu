import type { Context } from "@fuyu/plugin-base";
import { loadDefaultEcdictEngine } from "./dictionary.ts";

export const name = "@fuyu/ecdict";
export const inject = ["translator.engines"];

export const ENGINE_ID = "ecdict";
export const ENGINE_LABEL = {
  "zh-CN": "离线词典",
  en: "Offline dictionary",
} as const;
export const DEFAULT_MODEL = "offline";

export function apply(ctx: Context) {
  const dictionary = loadDefaultEcdictEngine(import.meta.url);

  ctx.translatorEngines.register({
    engine: ENGINE_ID,
    label: ENGINE_LABEL,
    defaultModel: DEFAULT_MODEL,
    hasSecret: true,
    translate: ({ text, direction }) => ({
      text: dictionary.translate(text, direction),
    }),
  });
}
