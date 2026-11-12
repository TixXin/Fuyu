import { isTauri } from "@tauri-apps/api/core";
import { applyTodosChange, listenTodosChanged, migrateTodos } from "./api";
import { normalizeLocalTodoKeys } from "./normalize";
import { markTodosMigrated, readLocalTodoKeys } from "./storage";
import { adoptTodoFileData, setTodoStoreNotice, switchToTodoFile } from "./todoStore";

let prepared: Promise<void> | null = null;

export function prepareTodoStore(): Promise<void> {
  prepared ??= run();
  return prepared;
}

async function run() {
  if (!isTauri()) return;
  const keys = readLocalTodoKeys();
  try {
    const snapshot = await migrateTodos(keys, normalizeLocalTodoKeys(keys));
    switchToTodoFile(snapshot.data, snapshot.revision, applyTodosChange);
    markTodosMigrated();
    if (snapshot.notice === "reimported") setTodoStoreNotice("reimported");
  } catch (error) {
    console.error("Could not move the todos to todos.json; using localStorage", error);
    setTodoStoreNotice("migrationFailed");
    return;
  }
  await listenTodosChanged(({ data, revision, fields }) => adoptTodoFileData(data, revision, fields)).catch((error: unknown) =>
    console.error("Failed to listen for todo changes", error),
  );
}
