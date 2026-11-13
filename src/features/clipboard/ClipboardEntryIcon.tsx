import { ClipboardList, File, FileArchive, FileAudio, FileCode, FileImage, FileText, FileVideo, Files, KeyRound, type LucideIcon } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem } from "./api";
import { itemFileKind, sourceName, type FileKind } from "./fileEntry";
import { useAppIcon } from "./useAppIcon";
import "./ClipboardEntryIcon.css";

const FILE_ICONS: Record<FileKind, LucideIcon> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  code: FileCode,
  document: FileText,
  other: File,
};

export function ClipboardEntryIcon({ item, className }: { item: ClipboardHistoryItem; className?: string }) {
  const t = useTranslation();
  const appIcon = useAppIcon(item.source?.path);
  const fileKind = itemFileKind(item);
  const several = item.kind === "files" && (item.files?.length ?? 0) > 1;
  const Fallback = item.masked ? KeyRound : fileKind ? (several && fileKind === "other" ? Files : FILE_ICONS[fileKind]) : ClipboardList;
  return (
    <span className={`clipboard-entry-icon${className ? ` ${className}` : ""}`} title={sourceName(item, t.settings.project.appName, t.clipboard.popup.screenshotSource)}>
      <Fallback size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      {appIcon && <img className="clipboard-entry-icon__app" src={appIcon} alt="" aria-hidden="true" />}
    </span>
  );
}
