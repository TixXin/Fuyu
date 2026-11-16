import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { useTodos } from "../useTodos";

type Todos = ReturnType<typeof useTodos>;

export type TodosIsland = Pick<Todos, "todos" | "activeTodoId" | "notebookProps" | "addTodoOn">;
export type TodoLine = { title: string | null; count: number | null };

export const todosIsland = createRunnerStore<TodosIsland | null>(null);
export const todoLine = createRunnerStore<TodoLine>({ title: null, count: null });
