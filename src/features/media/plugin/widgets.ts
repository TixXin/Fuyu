import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const NOW_PLAYING_WIDGET: BuiltinWidget = { id: "music", owner: OWNER, group: "music", sizes: ["bar", "m"], order: 30, label: (t) => t.islandWidgets.widgets.nowPlaying };
export const LYRICS_WIDGET: BuiltinWidget = { id: "lyrics", owner: OWNER, group: "music", sizes: ["w"], order: 31, label: (t) => t.islandWidgets.widgets.lyrics };

export const islandWidgets: readonly BuiltinWidget[] = [NOW_PLAYING_WIDGET, LYRICS_WIDGET];
