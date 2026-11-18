import { createStore } from "../../stage/store";
import type { Chapter, TermLine } from "./copy";

export type Look = "swiss" | "glass" | "ascii";
export const LOOK: Look = (new URLSearchParams(location.search).get("look") as Look | null) ?? "glass";

export type ChatLine = { from: "me" | "bot"; text: string };

export type Scene = {
  card: (Chapter & { id: number; full: boolean }) | null;
  terms: Record<string, TermLine[]>;
  focus: string | null;
  away: boolean;
  phone: "hidden" | "push" | "chat";
  chat: ChatLine[];
  pr: "hidden" | "open" | "merged";
  settings: "hidden" | "open" | "closed";
  cover: "in" | "out" | "hidden";
  cursor: { x: number; y: number; ms: number; visible: boolean; pressed: boolean };
  gather: boolean;
  ring: string | null;
  zoom: { x: number; y: number; scale: number };
};

export const scene = createStore<Scene>({
  card: null, terms: {}, focus: null, away: false, phone: "hidden", chat: [], pr: "hidden", settings: "hidden", cover: "in",
  cursor: { x: 640, y: 560, ms: 0, visible: false, pressed: false },
  gather: false, ring: null, zoom: { x: 640, y: 360, scale: 1 },
});

let cardId = 0;

export function showCard(chapter: Chapter, full: boolean) {
  cardId += 1;
  scene.set({ card: { ...chapter, id: cardId, full } });
}

export function hideCard() {
  scene.set({ card: null });
}

export function addLine(term: string, line: TermLine) {
  scene.set((current) => ({ terms: { ...current.terms, [term]: [...(current.terms[term] ?? []), line] } }));
}
