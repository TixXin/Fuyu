export type TodoPageMode = "today" | "daily" | "archive" | "review" | "upcoming";

export type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  /** The project it belongs to (issue #44); absent for none. Older versions drop it when they save. */
  project?: string;
};

/** A todo planned for a later day; it joins that day's list when the day arrives. */
export type ScheduledTodo = {
  id: string;
  title: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  createdAt: number;
  /** As TodoItem.project; it keeps it when the day comes. */
  project?: string;
};

export type TodoArchive = {
  date: string;
  todos: TodoItem[];
  dailyNote: string;
  savedAt: number;
  savedToDisk: boolean;
  filePath?: string;
};

export type SaveState = "idle" | "saving" | "saved" | "needs-path" | "error";
export type SavePathState = "idle" | "saved";

/** What the todo page gets (useTodos' notebookProps, with the two settings below). */
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
  /** Rows shown before the list scrolls; the island grows to fit this many. */
  scrollStartRows: number;
  /** Day the next todo is for, or null for the list's own day. */
  draftDate: string | null;
  scheduledTodos: ScheduledTodo[];
  onDraftChange: (value: string) => void;
  onDraftDateChange: (date: string | null) => void;
  /** Adds the draft; `project`, the one the list is filtered to, unless the draft names its own ("#name title"). */
  onAddTodo: (project?: string) => void;
  onShowUpcoming: () => void;
  onDeleteScheduledTodo: (id: string) => void;
  onToggleTodo: (id: string) => void;
  onUpdateTodo: (id: string, title: string) => void;
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
