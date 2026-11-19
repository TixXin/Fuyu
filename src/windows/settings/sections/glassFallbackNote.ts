import type { GlassBackdrop } from "../../../lib/settings/glassSettings";
import type { GlassFallbackReason, IslandGlassStatus } from "../../island/glassStatus";

export type GlassFallbackNote = { shown: "wallpaper" | "css"; reason: GlassFallbackReason };

export function glassFallbackNote(choice: GlassBackdrop, status: IslandGlassStatus | null): GlassFallbackNote | null {
  if (!status?.reason || choice === "none") return null;
  if (status.backdrop === "css") return { shown: "css", reason: status.reason };
  if (status.backdrop === "wallpaper" && choice === "native") return { shown: "wallpaper", reason: status.reason };
  return null;
}
