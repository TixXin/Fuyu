import type { AppliedTodosChange, TodosChange, TodosData } from "./api";

type Writer = (change: TodosChange) => Promise<AppliedTodosChange>;
type Listener = (data: Readonly<TodosData>, changed: ReadonlySet<keyof TodosData>) => void;
export type TodoStoreNotice = "migrationFailed" | "reimported";

const RETRY_MS = 2000;

let data: TodosData | null = null;
let revision = 0;
let writer: Writer | null = null;
let pending: TodosChange = {};
let hasPending = false;
let writing = false;
let notice: TodoStoreNotice | null = null;
const listeners = new Set<Listener>();

export function switchToTodoFile(initial: TodosData, initialRevision: number, write: Writer) {
  data = { ...initial };
  revision = initialRevision;
  writer = write;
}

export function todoFileData(): Readonly<TodosData> | null {
  return data;
}

export function setTodoStoreNotice(next: TodoStoreNotice) {
  notice = next;
}

export function takeTodoStoreNotice() {
  const current = notice;
  notice = null;
  return current;
}

export function subscribeTodoFile(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function adoptTodoFileData(next: TodosData, nextRevision: number, fields: readonly (keyof TodosData)[]) {
  if (!data) return;
  revision = Math.max(revision, nextRevision);
  const changed = new Set<keyof TodosData>();
  let adopted: TodosData = data;
  for (const key of fields) {
    if (!(key in next) || JSON.stringify(next[key]) === JSON.stringify(adopted[key])) continue;
    changed.add(key);
    adopted = { ...adopted, [key]: next[key] };
    delete pending[key];
  }
  data = adopted;
  hasPending = Object.keys(pending).length > 0;
  if (changed.size === 0) return;
  for (const listener of listeners) listener(adopted, changed);
}

export function queueTodoChange(change: TodosChange) {
  if (!data) return;
  let changed = false;
  for (const key of Object.keys(change) as (keyof TodosData)[]) {
    const value = change[key];
    if (value === undefined || JSON.stringify(value) === JSON.stringify(data[key])) continue;
    data = { ...data, [key]: value };
    pending = { ...pending, [key]: value };
    changed = true;
  }
  if (!changed) return;
  hasPending = true;
  void flush();
}

async function flush() {
  if (writing || !hasPending || !writer) return;
  writing = true;
  const change = pending;
  pending = {};
  hasPending = false;
  let applied: AppliedTodosChange;
  try {
    applied = await writer({ ...change, baseRevision: revision });
  } catch (error) {
    console.error("Failed to save the todos; trying again", error);
    pending = { ...change, ...pending };
    hasPending = true;
    writing = false;
    window.setTimeout(() => void flush(), RETRY_MS);
    return;
  }
  writing = false;
  if (applied.data && applied.conflicts.length > 0) adoptTodoFileData(applied.data, applied.revision, applied.conflicts);
  else revision = Math.max(revision, applied.revision);
  if (hasPending) void flush();
}
