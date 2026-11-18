import type { Translations } from "../types";
import { coreEn } from "./core-en.ts";
import { onboarding } from "./onboarding-en.ts";
import { settings, sync } from "./settings-en.ts";

const en: Translations = {
  ...coreEn,
  settings,
  onboarding,
  sync,
};

export default en;
