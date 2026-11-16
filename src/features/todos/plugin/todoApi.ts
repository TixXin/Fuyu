import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { TodoApiHandlers } from "../useTodoApiHandlers";

type Announce = (change: { date: string }) => void;

export const todoApi = createRunnerStore<TodoApiHandlers | null>(null);

let announce: Announce | null = null;

export function onTodosChanged(listener: Announce) {
  announce = listener;
}

export function announceTodosChanged(date: string) {
  announce?.({ date });
}
