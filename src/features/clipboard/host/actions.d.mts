export type ClipboardActionIcon =
  | "paste"
  | "plain"
  | "enter"
  | "edit"
  | "wand"
  | "file"
  | "image"
  | "qr"
  | "star"
  | "tag"
  | "snippet"
  | "trash"
  | "pause"
  | "play"
  | "skip"
  | "ai"
  | "key"
  | "eraser";

export type ClipboardActionItem = {
  id: string;
  kind: "text" | "image" | "files";
  hash: string;
  createdAt: number;
  copiedAt: number;
  favorite?: boolean;
  note?: string;
  preview: string;
  text?: string;
  html?: string;
  files?: string[];
  tags?: string[];
  ocrText?: string;
  masked?: boolean;
  truncated?: boolean;
};

export type ClipboardActionLabel =
  | { zh: string; en: string }
  | ((locale: "zh" | "en") => string);

export type ClipboardActionContext = {
  item: ClipboardActionItem;
  locale: "zh" | "en";
  copyText?: (text: string) => void | Promise<void>;
  pasteText?: (text: string, enter?: boolean) => void | Promise<void>;
};

export type ClipboardActionSpec = {
  id: string;
  label: ClipboardActionLabel;
  note?: string | ClipboardActionLabel;
  icon?: ClipboardActionIcon;
  group?: "paste" | "entry" | "record";
  keywords?: readonly string[];
  order?: number;
  match?: (item: ClipboardActionItem) => boolean;
  run: (context: ClipboardActionContext) => void | Promise<void>;
};

export type ClipboardActionRegistry = {
  register(spec: ClipboardActionSpec): () => void;
  list(): ClipboardActionSpec[];
  forItem(item: ClipboardActionItem | undefined): ClipboardActionSpec[];
  subscribe(listener: () => void): () => void;
  run(id: string, context: ClipboardActionContext): Promise<unknown>;
  clear(): void;
};

export function resolveClipboardActionLabel(
  label: string | ClipboardActionLabel | undefined,
  locale?: "zh" | "en",
): string;
export function createClipboardActionRegistry(options?: {
  onChange?: () => void;
}): ClipboardActionRegistry;
export function registerClipboardAction(spec: ClipboardActionSpec): () => void;
export function getClipboardActions(): ClipboardActionSpec[];
export function getClipboardActionsForItem(
  item: ClipboardActionItem | undefined,
): ClipboardActionSpec[];
export function subscribeClipboardActions(listener: () => void): () => void;
export function runClipboardAction(
  id: string,
  context: ClipboardActionContext,
): Promise<unknown>;
export function clearClipboardActionsForTest(): void;
