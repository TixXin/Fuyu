import type { LocaleCode } from "../../i18n/types";

/** Public pages linked from Settings → About. */
export const PROJECT_REPO_URL = "https://github.com/TixXin/fuyu";

const WEBSITE_URL = "https://fuyu.tix.xin";

/** A page of the website, fuyu.tix.xin, in the interface language (English pages live under /en/). */
export function websitePage(locale: LocaleCode, path: "" | "community/" | "releases/" = "") {
  return `${WEBSITE_URL}/${locale === "en" ? "en/" : ""}${path}`;
}
