import { useId } from "react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import type { CategoryState, SyncCategory, SyncStatus } from "./api";
import { SYNC_CATEGORY_ITEMS } from "./syncState";

function stateTone(state: CategoryState): "ok" | "warn" | "error" | "muted" {
  if (state === "ok") return "ok";
  if (state === "needsConfirm" || state === "newerVersion") return "warn";
  if (state === "error") return "error";
  return "muted";
}

function SyncCategoryRow({
  category,
  state,
  message,
  folderSet,
  busy,
  onToggle,
}: {
  category: SyncCategory;
  state: CategoryState;
  message: string | null;
  folderSet: boolean;
  busy: boolean;
  onToggle: (category: SyncCategory, checked: boolean) => void;
}) {
  const id = useId();
  const text = useTranslation().sync.categories;
  const copy = text.items[category];
  const checked = state !== "off";
  const showBadge = folderSet && checked;

  return (
    <SettingsRow
      labelFor={id}
      title={copy.title}
      description={
        message ? (
          <>
            <span>{copy.description}</span>
            <span className="sync-category__error">{message}</span>
          </>
        ) : (
          copy.description
        )
      }
      control={
        <div className="sync-category__control">
          {showBadge ? (
            <span className={`sync-badge sync-badge--${stateTone(state)}`}>
              {text.states[state]}
            </span>
          ) : null}
          <SettingsSwitch
            id={id}
            checked={checked}
            disabled={busy}
            onChange={(next) => onToggle(category, next)}
          />
        </div>
      }
    />
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
    <SettingsGroup
      title={text.groupTitle}
      footer={<SettingsFootnote text={text.footnote} />}
    >
      {SYNC_CATEGORY_ITEMS.map((category) => {
        const current = byCategory.get(category);
        return (
          <SyncCategoryRow
            key={category}
            category={category}
            state={current?.state ?? "waiting"}
            message={current?.message ?? null}
            folderSet={status.folder !== null}
            busy={busy}
            onToggle={onToggle}
          />
        );
      })}
    </SettingsGroup>
  );
}
