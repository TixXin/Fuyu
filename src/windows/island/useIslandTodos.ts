import { useCallback, type Dispatch, type SetStateAction } from "react";
import { openSettingsWindow } from "../settings/api";
import { useTodos } from "../../features/todos/useTodos";
import { useLocalApiBridge } from "../../features/local-api/useLocalApiBridge";
import { useBackgroundUpdateCheck } from "../../features/updater/useBackgroundUpdateCheck";
import type { AgentStatusSnapshot } from "../../features/agent-status/api";
import type { IslandSettings } from "../../features/appearance/types";
import { usePluginHostEvents } from "./usePluginHostEvents";
import { usePluginKeybindings } from "./usePluginKeybindings";
import type { IslandMode, IslandPage } from "./types";

type IslandTodosOptions = {
  settings: IslandSettings;
  setSettings: Dispatch<SetStateAction<IslandSettings>>;
  mode: IslandMode;
  page: IslandPage;
  agentStatus: AgentStatusSnapshot;
  collapseIsland: () => void;
};

export function useIslandTodos({ settings, setSettings, mode, page, agentStatus, collapseIsland }: IslandTodosOptions) {
  const openSavePathSettings = useCallback(() => {
    openSettingsWindow("savePath");
  }, []);

  const saveProjects = useCallback((todoProjects: IslandSettings["todoProjects"]) => {
    setSettings((current) => ({ ...current, todoProjects }));
  }, [setSettings]);
  const { todos, activeTodoId, apiHandlers, notebookProps, addTodoOn } = useTodos({
    carryOverIncompleteTodos: settings.carryOverIncompleteTodos,
    projects: settings.todoProjects,
    onProjectsChange: saveProjects,
    onStartTodo: collapseIsland,
    onMissingSaveDirectory: openSavePathSettings,
  });
  const openUpdateSettings = useCallback(() => { openSettingsWindow("updates"); }, []);
  useLocalApiBridge(apiHandlers);
  useBackgroundUpdateCheck(openUpdateSettings);
  usePluginHostEvents({
    date: notebookProps.currentDate,
    todosVersion: [todos, notebookProps.scheduledTodos, activeTodoId],
    note: notebookProps.dailyNote,
    agentStatus,
    mode,
  });
  usePluginKeybindings({ mode, page, hasActiveTodo: activeTodoId !== null });
  return { todos, activeTodoId, notebookProps, addTodoOn };
}
