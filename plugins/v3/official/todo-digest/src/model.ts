export const METHODS = {
  state: "state",
  writeDigest: "writeDigest",
} as const;

export const TOPICS = {
  state: "state",
} as const;

export type DigestTodo = {
  id: string;
  title: string;
  project?: string;
};

export type DigestState = {
  date: string;
  total: number;
  openCount: number;
  open: DigestTodo[];
  lastWrittenAt: number | null;
  at: number;
};

export const EMPTY_STATE: DigestState = {
  date: "",
  total: 0,
  openCount: 0,
  open: [],
  lastWrittenAt: null,
  at: 0,
};
