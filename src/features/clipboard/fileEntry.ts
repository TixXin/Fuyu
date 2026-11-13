import type { ClipboardHistoryItem } from "./api";

export type FileKind = "image" | "video" | "audio" | "archive" | "code" | "document" | "other";

const KINDS: Record<Exclude<FileKind, "other">, readonly string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic", "heif", "tif", "tiff", "svg", "ico", "avif"],
  video: ["mp4", "mov", "mkv", "avi", "webm", "m4v", "flv", "wmv"],
  audio: ["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "aiff"],
  archive: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "dmg", "iso"],
  code: ["js", "mjs", "ts", "tsx", "jsx", "json", "rs", "py", "go", "java", "c", "cpp", "h", "cs", "sh", "ps1", "html", "css", "yml", "yaml", "toml", "sql"],
  document: ["txt", "md", "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "pages", "numbers", "key", "rtf"],
};

const OWN_SOURCE = /^(fuyu|浮屿)$/i;
const PLAIN_FOLDERS = /^(te?mp|rwtemp|caches?|\d{4}(-\d{2}){1,2})$/i;

function parts(path: string) {
  return path.split(/[\\/]+/).filter(Boolean);
}

export function fileKind(path: string): FileKind {
  const name = parts(path).pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "other";
  const extension = name.slice(dot + 1).toLowerCase();
  const found = (Object.keys(KINDS) as (keyof typeof KINDS)[]).find((kind) => KINDS[kind].includes(extension));
  return found ?? "other";
}

export function fileFolder(path: string): string | null {
  const segments = parts(path);
  const folder = segments.length >= 2 ? segments[segments.length - 2] : null;
  return folder && !PLAIN_FOLDERS.test(folder) ? folder : null;
}

export function itemFileKind(item: ClipboardHistoryItem): FileKind | null {
  if (item.kind !== "files" || !item.files?.length) return null;
  const kinds = new Set(item.files.map(fileKind));
  return kinds.size === 1 ? [...kinds][0] : "other";
}

export function fileImageLabel(item: ClipboardHistoryItem, formatBytes: (bytes: number) => string): string | null {
  const image = item.kind === "files" ? item.fileImage : undefined;
  if (!image) return null;
  return image.byteSize > 0 ? `${image.width}×${image.height} · ${formatBytes(image.byteSize)}` : `${image.width}×${image.height}`;
}

export function sourceName(item: ClipboardHistoryItem, appName: string, screenshot = appName): string | undefined {
  const name = item.source?.name;
  if (!name || !OWN_SOURCE.test(name)) return name;
  return item.kind === "image" ? screenshot : appName;
}
