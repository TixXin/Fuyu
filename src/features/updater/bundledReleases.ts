import dates from "virtual:fuyu-release-dates";
import { versionOfNotePath, type ReleaseEntry } from "./releaseHistory.ts";

export type BundledRelease = ReleaseEntry & { load: () => Promise<string> };

const NOTES = import.meta.glob<string>("/docs/releases/v*.md", { query: "?raw", import: "default" });

export const BUNDLED_RELEASES: BundledRelease[] = Object.entries(NOTES).flatMap(([path, load]) => {
  const version = versionOfNotePath(path);
  return version ? [{ version, date: dates[version] ?? null, load }] : [];
});
