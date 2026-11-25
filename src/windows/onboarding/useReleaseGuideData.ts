import { useEffect, useState } from "react";
import { getAppVersion } from "../../features/updater/api";
import { BUNDLED_RELEASES } from "../../features/updater/bundledReleases";
import { compareVersions, historyNoteLines, parseVersion } from "../../features/updater/releaseHistory";
import type { ReleaseNoteLine } from "../../features/updater/releaseNotes";

export type ReleaseGuideData = {
  version: string;
  date: string | null;
  lines: ReleaseNoteLine[];
  loading: boolean;
};

function latestBundled(targetVersion: string | null) {
  const sorted = [...BUNDLED_RELEASES]
    .map((entry) => ({ entry, parsed: parseVersion(entry.version) }))
    .filter((item) => item.parsed !== null)
    .sort((a, b) => compareVersions(b.parsed!, a.parsed!));
  if (sorted.length === 0) return null;
  if (targetVersion) {
    const exact = sorted.find(({ entry }) => entry.version === targetVersion);
    if (exact) return exact.entry;
    const targetParsed = parseVersion(targetVersion);
    if (targetParsed) {
      const below = sorted.find(({ parsed }) => compareVersions(parsed!, targetParsed) <= 0);
      if (below) return below.entry;
    }
  }
  return sorted[0].entry;
}

export function useReleaseGuideData(locale: "zh-CN" | "en"): ReleaseGuideData {
  const [data, setData] = useState<ReleaseGuideData>({ version: "", date: null, lines: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    void getAppVersion()
      .catch(() => "")
      .then(async (appVersion) => {
        const entry = latestBundled(appVersion || null);
        const version = appVersion || entry?.version || "";
        if (!entry) {
          if (!cancelled) setData({ version, date: null, lines: [], loading: false });
          return;
        }
        try {
          const raw = await entry.load();
          if (cancelled) return;
          setData({ version, date: entry.date, lines: historyNoteLines(raw, locale), loading: false });
        } catch {
          if (!cancelled) setData({ version, date: entry.date, lines: [], loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return data;
}
