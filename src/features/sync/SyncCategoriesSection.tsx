import { useId } from "react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useTranslation } from "../../i18n";
import type { CategoryState, SyncCategory, SyncStatus } from "./api";
import { SYNC_CATEGORY_ITEMS } from "./syncState";
import "./SyncCategoriesSection.css";

function stateTone(state: CategoryState): "ok" | "warn" | "error" | "muted" {
  if (state === "ok") return "ok";
  if (state === "needsConfirm" || state === "newerVersion") return "warn";
  if (state === "error") return "error";
  return "muted";
}

function SyncCategoryTile({
  category,
  state,
  message,
  busy,
  onToggle,
}: {
  category: SyncCategory;
  state: CategoryState;
  message: string | null;
  busy: boolean;
  onToggle: (category: SyncCategory, checked: boolean) => void;
}) {
  const id = useId();
  const text = useTranslation().sync.categories;
  const copy = text.items[category];
  const checked = state !== "off";
  const tone = stateTone(state);

  return (
    <div className={`settings-row sync-tile${checked ? " sync-tile--on" : ""}${message ? " sync-tile--error" : ""}`}>
      <label className="sync-tile__main" htmlFor={id} title={copy.description}>
        <input
          id={id}
          className="sync-tile__box"
          type="checkbox"
          checked={checked}
          disabled={busy}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onToggle(category, event.currentTarget.checked)}
        />
        <span className="settings-row__text sync-tile__text">
          <span className="settings-row__title sync-tile__name">{copy.title}</span>
          <span className="settings-row__description sync-tile__hint" id={`${id}-hint`}>{copy.hint}</span>
        </span>
        <span className={`sync-badge sync-badge--${tone}`}>{text.states[state]}</span>
      </label>
      {message ? <p className="sync-tile__error" role="alert">{message}</p> : null}
    </div>
  );
}

export function SyncCategoriesSection({
  status,
  busy,
  onToggle,
}: {
  status: SyncStatus;
  busy: boolean;
  onToggle: (category: SyncCategory, checked: boolean) => void;
}) {
  const text = useTranslation().sync.categories;
  const byCategory = new Map(status.categories.map((entry) => [entry.category, entry]));

  return (
    <SettingsGroup title={text.groupTitle} footer={<SettingsFootnote text={text.footnote} />}>
      <div className="sync-tiles">
        {SYNC_CATEGORY_ITEMS.map((category) => {
          const current = byCategory.get(category);
          return (
            <SyncCategoryTile
              key={category}
              category={category}
              state={current?.state ?? "waiting"}
              message={current?.message ?? null}
              busy={busy}
              onToggle={onToggle}
            />
          );
        })}
      </div>
    </SettingsGroup>
  );
}
