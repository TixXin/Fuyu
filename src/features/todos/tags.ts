import { readRecurrence } from "./recurrence.ts";
import type { TodoColor, TodoPriority, TodoRecurrence } from "./types.ts";

export const TODO_PRIORITIES: readonly TodoPriority[] = ["high", "medium", "low"];
export const TODO_COLORS: readonly TodoColor[] = ["red", "orange", "yellow", "green", "blue", "purple"];

export type TodoTags = {
  priority?: TodoPriority;
  color?: TodoColor;
  recurrence?: TodoRecurrence;
};

export function readPriority(value: unknown): TodoPriority | undefined {
  return TODO_PRIORITIES.find((priority) => priority === value);
}

export function readColor(value: unknown): TodoColor | undefined {
  return TODO_COLORS.find((color) => color === value);
}

export function readTags(value: { priority?: unknown; color?: unknown; recurrence?: unknown }): TodoTags {
  const priority = readPriority(value.priority);
  const color = readColor(value.color);
  const recurrence = readRecurrence(value.recurrence);
  return {
    ...(priority ? { priority } : {}),
    ...(color ? { color } : {}),
    ...(recurrence ? { recurrence } : {}),
  };
}

export function withTags<T extends TodoTags>(todo: T, tags: TodoTags): T {
  const next = { ...todo, ...tags };
  if (!readPriority(next.priority)) delete next.priority;
  if (!readColor(next.color)) delete next.color;
  const recurrence = readRecurrence(next.recurrence);
  if (recurrence) next.recurrence = recurrence;
  else delete next.recurrence;
  return next;
}
