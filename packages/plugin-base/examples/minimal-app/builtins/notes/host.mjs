import { notesV1 } from "../../services.mjs";

export const name = "notes";

export function apply(ctx) {
  const provider = ctx.services.provide(notesV1, {
    list: () => ctx.rust.call("storage.read"),
    add: async (params) => {
      const text = String(params?.text ?? "").trim();
      const note = await ctx.rust.call("storage.write", { text });
      provider.emit("added", note);
      return note;
    },
  });
  ctx.rust.on("storage.seeded", (note) => {
    provider.emit("added", note);
  });
}
