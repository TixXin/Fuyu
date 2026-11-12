export type TodoProject = { id: string; name: string };

export type TodoPageMode = "today" | "daily" | "archive" | "review" | "upcoming";

export type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  project?: string;
};

export type ScheduledTodo = {
  id: string;
  title: string;
  date: string;
  createdAt: number;
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
  onCreateProject: (name: string) => void;
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
