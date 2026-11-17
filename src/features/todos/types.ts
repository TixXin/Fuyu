import type { TodoTags } from "./tags";
import type { TodoProject } from "../../lib/todo-projects/prefix";

export type { TodoProject };

export type TodoPriority = "high" | "medium" | "low";
export type TodoColor = "red" | "orange" | "yellow" | "green" | "blue" | "purple";

export type TodoPageMode = "today" | "daily" | "archive" | "review" | "upcoming";

export type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  project?: string;
  startedAt?: number;
  priority?: TodoPriority;
  color?: TodoColor;
  updatedAt?: string;
  deviceId?: string;
};

export type ScheduledTodo = {
  id: string;
  title: string;
  date: string;
  createdAt: number;
  project?: string;
  priority?: TodoPriority;
  color?: TodoColor;
  updatedAt?: string;
  deviceId?: string;
};

export type TodoArchive = {
  date: string;
  todos: TodoItem[];
  dailyNote: string;
  savedAt: number;
  savedToDisk: boolean;
  filePath?: string;
  updatedAt?: string;
};

export type SaveState = "idle" | "saving" | "saved" | "needs-path" | "error";
export type SavePathState = "idle" | "saved";

export type TodoPageProps = {
  todos: TodoItem[];
  dailyNote: string;
  draft: string;
  activeTodoId: string | null;
  currentDate: string;
  pageMode: TodoPageMode;
  archives: TodoArchive[];
  selectedArchive: TodoArchive | null;
  saveState: SaveState;
  enableTodoReorder: boolean;
  scrollStartRows: number;
  draftDate: string | null;
  scheduledTodos: ScheduledTodo[];
  onDraftChange: (value: string) => void;
  onDraftDateChange: (date: string | null) => void;
  onAddTodo: (project?: string) => void;
  projects: readonly string[];
  canCreateProject: boolean;
  onCreateProject: (name: string) => string | undefined;
  onShowUpcoming: () => void;
  onDeleteScheduledTodo: (id: string) => void;
  onTagScheduledTodo: (id: string, tags: TodoTags) => void;
  onToggleTodo: (id: string) => void;
  onUpdateTodo: (id: string, title: string) => void;
  onTagTodo: (id: string, tags: TodoTags) => void;
  onStartTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onReorderTodo: (sourceId: string, targetId: string) => void;
  onSaveToday: () => void;
  onShowArchive: () => void;
  onShowDaily: () => void;
  onShowToday: () => void;
  onDailyNoteChange: (value: string) => void;
  onSelectArchive: (date: string) => void;
};
