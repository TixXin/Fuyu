import { ClipboardList, FileText, Files, KeyRound } from "lucide-react";
import type { ClipboardHistoryItem } from "./api";
import { useAppIcon } from "./useAppIcon";
import "./ClipboardEntryIcon.css";

export function ClipboardEntryIcon({ item, className }: { item: ClipboardHistoryItem; className?: string }) {
  const appIcon = useAppIcon(item.source?.path);
  const Fallback = item.masked ? KeyRound : item.kind === "files" ? (item.files && item.files.length > 1 ? Files : FileText) : ClipboardList;
  return (
    <span className={`clipboard-entry-icon${className ? ` ${className}` : ""}`} title={item.source?.name}>
      <Fallback size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      {appIcon && <img className="clipboard-entry-icon__app" src={appIcon} alt="" aria-hidden="true" />}
    </span>
  );
}
