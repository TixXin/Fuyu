import { compareVersions, isPrerelease, satisfies } from "./semver.mjs";
import { revocationOf } from "./revoked.mjs";
import { timeOf } from "./fields.mjs";

const DAY = 24 * 60 * 60 * 1000;
export const COOLDOWN_DAYS = 3;

const toTime = (now) => (now instanceof Date ? now.getTime() : (now ?? Date.now()));

export function cooledDown(entry, now, cooldownDays = COOLDOWN_DAYS) {
  if (entry.urgent) return true;
  return toTime(now) - timeOf(entry.publishedAt) >= cooldownDays * DAY;
}

export function selectVersions(plugin, { fuyuVersion, platform, now, installed = null, revocations = null, prerelease = false, cooldownDays = COOLDOWN_DAYS }) {
  const at = toTime(now);
  const candidates = [];
  const skipped = [];
  for (const entry of plugin?.versions ?? []) {
    const revocation = revocationOf(revocations, plugin.name, entry.version);
    let reason = null;
    if (!entry.platforms?.includes(platform)) reason = "platform";
    else if (!satisfies(fuyuVersion, entry.engines?.fuyu)) reason = "engines";
    else if (!prerelease && isPrerelease(entry.version)) reason = "prerelease";
    else if (revocation?.level === "disable") reason = "revoked";
    if (reason) skipped.push({ version: entry.version, reason });
    else candidates.push({ entry, warned: revocation?.level === "warn", cooled: cooledDown(entry, at, cooldownDays) });
  }
  candidates.sort((a, b) => compareVersions(b.entry.version, a.entry.version));
  const newer = (item) => installed === null || compareVersions(item.entry.version, installed) > 0;
  const quiet = candidates.filter((item) => !item.warned);
  const manual = candidates.find(newer) ?? null;
  const autoUpdate = installed === null ? null : (quiet.find((item) => item.cooled && newer(item)) ?? null);
  const settled = quiet.find((item) => item.cooled);
  const install = settled ?? quiet[0] ?? null;
  return {
    manual: manual && { entry: manual.entry, cooled: manual.cooled, warned: manual.warned },
    autoUpdate: autoUpdate && { entry: autoUpdate.entry, urgent: Boolean(autoUpdate.entry.urgent) },
    install: install && { entry: install.entry, fresh: !install.cooled },
    skipped,
  };
}
