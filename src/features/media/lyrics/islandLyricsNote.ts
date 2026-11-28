import type { CollapsedText } from "../../../lib/settings/collapsedText";
import type { IslandSettings } from "../../../lib/settings/types";

export type IslandLyricsNote = "textOff" | "hidden" | "noSource" | "notchOff" | "notchPanel";

type NoteSettings = Pick<IslandSettings, "showCollapsedText" | "lyricsOnline" | "lyricsFolder" | "islandForm">;

export function islandLyricsNote(settings: NoteSettings, text: Pick<CollapsedText, "notch" | "hidden">, mac: boolean): IslandLyricsNote | null {
  if (!settings.showCollapsedText) return "textOff";
  if (text.hidden.includes("lyrics")) return "hidden";
  if (!settings.lyricsOnline && !settings.lyricsFolder.trim()) return "noSource";
  const notch = settings.islandForm === "notch" || (mac && settings.islandForm === "auto");
  if (notch && text.notch.lyrics === "off") return "notchOff";
  if (notch && text.notch.lyrics === "panel") return "notchPanel";
  return null;
}
