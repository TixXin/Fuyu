import type { Translations } from "../types";
import { coreZhCN } from "./core-zh-CN.ts";
import { onboarding } from "./onboarding-zh-CN.ts";
import { settings, sync } from "./settings-zh-CN.ts";

const zhCN: Translations = {
  ...coreZhCN,
  settings,
  onboarding,
  sync,
};

export default zhCN;
