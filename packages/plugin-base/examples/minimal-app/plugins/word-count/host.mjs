import { notesV1 } from "../../services.mjs";

export const name = "word-count";
export const inject = ["clients", "notes/v1"];

function wordsOf(text) {
  return String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export async function apply(ctx) {
  const notes = ctx.services.get(notesV1);
  const initial = await notes.list({});
  const state = {
    notes: initial.length,
    words: initial.reduce((sum, item) => sum + wordsOf(item.text), 0),
  };
  ctx.clients.handle("summary", () => ({ ...state }));
  notes.on("added", (note) => {
    state.notes += 1;
    state.words += wordsOf(note.text);
    ctx.clients.publish("updated", { ...state });
  });
}
