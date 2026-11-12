import { AlertCircle, Check, ChevronLeft, Download, ListX, LoaderCircle } from "lucide-react";
import { RowMenu, type RowMenuItem } from "../../../components/list/RowMenu";
import { useTranslation } from "../../../i18n";
import type { SaveState, TodoArchive, TodoPageMode } from "../types";

type Tab = "today" | "daily" | "upcoming" | "archive";

const tabOf = (mode: TodoPageMode): Tab => (mode === "review" ? "archive" : mode);

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  if (total === 0) return null;
  return (
    <span className="todo-island__progress" aria-label={label}>
      <span className="todo-island__progress-track" aria-hidden="true"><span style={{ width: `${(done / total) * 100}%` }} /></span>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

export function TodoIslandHeader({
  pageMode,
  openCount,
  doneCount,
  scheduledCount,
  saveState,
  selectedArchive,
  onShowToday,
  onShowDaily,
  onShowUpcoming,
  onShowArchive,
  onSaveToday,
  onClearDone,
}: {
  pageMode: TodoPageMode;
  openCount: number;
  doneCount: number;
  scheduledCount: number;
  saveState: SaveState;
  selectedArchive: TodoArchive | null;
  onShowToday: () => void;
  onShowDaily: () => void;
  onShowUpcoming: () => void;
  onShowArchive: () => void;
  onSaveToday: () => void;
  onClearDone: () => void;
}) {
  const t = useTranslation();
  const text = t.todoIsland;
  const active = tabOf(pageMode);

  if (pageMode === "review" && selectedArchive) {
    const done = selectedArchive.todos.filter((todo) => todo.completed).length;
    return (
      <div className="todo-island__header">
        <button className="island-list-chip todo-island__back" type="button" aria-pressed="true" onClick={onShowArchive} aria-label={text.backToArchive}>
          <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
          <span>{selectedArchive.date}</span>
        </button>
        <Progress done={done} total={selectedArchive.todos.length} label={text.doneOf(done, selectedArchive.todos.length)} />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number; open: () => void }[] = [
    { id: "today", label: text.today, count: openCount, open: onShowToday },
    { id: "daily", label: text.note, open: onShowDaily },
    ...(scheduledCount > 0 || active === "upcoming" ? [{ id: "upcoming" as const, label: text.upcoming, count: scheduledCount, open: onShowUpcoming }] : []),
    { id: "archive", label: text.archive, open: onShowArchive },
  ];
  const total = openCount + doneCount;
  const menu: RowMenuItem[] = [
    { key: "save", label: text.save.idle, icon: <Download size={14} strokeWidth={2} />, onSelect: onSaveToday },
    { key: "clear", label: text.clearDone(doneCount), icon: <ListX size={14} strokeWidth={2} />, disabled: doneCount === 0, onSelect: onClearDone },
  ];

  return (
    <div className="todo-island__header">
      <div className="island-list-chips todo-island__tabs" role="tablist" aria-label={text.tabsLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className="island-list-chip todo-island__tab"
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            aria-pressed={tab.id === active}
            aria-label={tab.id === "today" ? `${tab.label}, ${text.openCount(openCount)}` : undefined}
            onClick={tab.open}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && <span className="todo-island__tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>
      {active === "today" && (
        <>
          <Progress done={doneCount} total={total} label={text.todayDone(doneCount, total)} />
          {saveState !== "idle" && <SaveStatus state={saveState} onSave={onSaveToday} />}
          <RowMenu label={t.common.more} items={menu} />
        </>
      )}
    </div>
  );
}

function SaveStatus({ state, onSave }: { state: SaveState; onSave: () => void }) {
  const text = useTranslation().todoIsland.save;
  const label = state === "saving" ? text.saving : state === "saved" ? text.saved : state === "needs-path" ? text.needsPath : text.error;
  const Icon = state === "saving" ? LoaderCircle : state === "saved" ? Check : AlertCircle;
  return (
    <button className={`island-list-icon-button todo-island__save todo-island__save--${state}`} type="button" aria-label={label} title={label} onClick={onSave}>
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
