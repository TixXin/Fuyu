import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useLocale, useTranslation } from "../../i18n";
import { BUNDLED_RELEASES, type BundledRelease } from "./bundledReleases";
import { historyNoteLines, parseVersion, releaseGroups, type ReleaseGroup } from "./releaseHistory";
import { getUpdateState, subscribeToUpdate } from "./updaterController";
import "./UpdatePanel.css";
import "./VersionHistory.css";

const RECENT_COUNT = 5;

type Notes = Record<string, string | null>;

function defaultVersion(group: ReleaseGroup<BundledRelease>) {
  return (group.stable ?? group.betas[0]).version;
}

function ReleaseNotesBody({ notes, version }: { notes: Notes; version: string }) {
  const text = useTranslation().settings.versionHistory;
  const { locale } = useLocale();
  const raw = notes[version];
  const lines = useMemo(() => (typeof raw === "string" ? historyNoteLines(raw, locale) : []), [raw, locale]);
  if (raw === undefined) return <p className="version-history__status" role="status">{text.loading}</p>;
  if (raw === null) return <p className="version-history__status" role="alert">{text.failed}</p>;
  if (lines.length === 0) return <p className="version-history__status">{text.empty}</p>;
  return (
    <div className="update-notes__body version-history__notes" data-version={version}>
      {lines.map((line, index) => (
        <p key={index} className={`update-notes__${line.kind}`}>{line.text}</p>
      ))}
    </div>
  );
}

function ReleaseItem({ group, current, open, onToggle, notes, selected, onSelect }: {
  group: ReleaseGroup<BundledRelease>;
  current: string;
  open: boolean;
  onToggle: () => void;
  notes: Notes;
  selected: string;
  onSelect: (version: string) => void;
}) {
  const text = useTranslation().settings.versionHistory;
  const id = useId();
  const head = group.stable ?? group.betas[0];
  const options = [...(group.stable ? [group.stable] : []), ...group.betas];
  const isCurrent = options.some((entry) => entry.version === current);

  return (
    <div className={open ? "version-history__item version-history__item--open" : "version-history__item"} data-base={group.base}>
      <button className="version-history__row" type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="version-history__name">v{group.base}</span>
        {isCurrent ? <span className="version-history__tag version-history__tag--current">{text.current}</span> : null}
        {group.stable ? null : <span className="version-history__tag version-history__tag--beta">{text.beta}</span>}
        {group.stable && group.betas.length > 0 ? <span className="version-history__meta">{text.betaCount(group.betas.length)}</span> : null}
        <span className="version-history__spacer" />
        {head.date ? <time className="version-history__date" dateTime={head.date}>{head.date}</time> : null}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="version-history__panel" id={id}>
          {options.length > 1 ? (
            <div className="version-history__chips" role="group" aria-label={text.versionsLabel(group.base)}>
              {options.map((entry) => {
                const beta = parseVersion(entry.version)?.beta ?? null;
                return (
                  <button
                    key={entry.version}
                    className="version-history__chip"
                    type="button"
                    aria-pressed={entry.version === selected}
                    title={entry.date ? `v${entry.version} · ${entry.date}` : `v${entry.version}`}
                    onClick={() => onSelect(entry.version)}
                  >
                    {beta === null ? text.stableChip : text.betaChip(beta)}
                  </button>
                );
              })}
            </div>
          ) : null}
          <ReleaseNotesBody notes={notes} version={selected} />
        </div>
      ) : null}
    </div>
  );
}

export function VersionHistory({ releases = BUNDLED_RELEASES }: { releases?: readonly BundledRelease[] }) {
  const text = useTranslation().settings.versionHistory;
  const current = useSyncExternalStore(subscribeToUpdate, () => getUpdateState().version);
  const groups = useMemo(() => releaseGroups(releases, current), [releases, current]);
  const [openBase, setOpenBase] = useState<string | null>(() => {
    const own = groups.find((group) => [group.stable, ...group.betas].some((entry) => entry?.version === current));
    return (own ?? groups[0])?.base ?? null;
  });
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Notes>({});
  const [showAll, setShowAll] = useState(false);
  const openGroup = groups.find((group) => group.base === openBase) ?? null;
  const selected = openGroup ? selection[openGroup.base] ?? defaultVersion(openGroup) : null;

  useEffect(() => {
    if (!selected || selected in notes) return;
    const release = releases.find((entry) => entry.version === selected);
    if (!release) return;
    let alive = true;
    release.load().then(
      (value) => { if (alive) setNotes((previous) => ({ ...previous, [selected]: value })); },
      () => { if (alive) setNotes((previous) => ({ ...previous, [selected]: null })); },
    );
    return () => { alive = false; };
  }, [selected, notes, releases]);

  if (groups.length === 0) return null;
  const visible = showAll ? groups : groups.slice(0, RECENT_COUNT);
  const hidden = groups.length - RECENT_COUNT;

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.footnote} />}>
      <div className="version-history">
        {visible.map((group) => (
          <ReleaseItem
            key={group.base}
            group={group}
            current={current}
            open={group.base === openBase}
            onToggle={() => setOpenBase(group.base === openBase ? null : group.base)}
            notes={notes}
            selected={group.base === openBase && selected ? selected : defaultVersion(group)}
            onSelect={(version) => setSelection((previous) => ({ ...previous, [group.base]: version }))}
          />
        ))}
        {hidden > 0 ? (
          <button className="version-history__more" type="button" onClick={() => setShowAll(!showAll)}>
            {showAll ? text.showLess : text.showOlder(hidden)}
          </button>
        ) : null}
      </div>
    </SettingsGroup>
  );
}
