import type { LocaleCode } from "../../i18n/types";

export const PROJECT_REPO_URL = "https://github.com/TixXin/fuyu";

const WEBSITE_URL = "https://fuyu.ing";

export function websitePage(locale: LocaleCode, path: "" | "community/" | "releases/" = "") {
  return `${WEBSITE_URL}/${locale === "en" ? "en/" : ""}${path}`;
}
