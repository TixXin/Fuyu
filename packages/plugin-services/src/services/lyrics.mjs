import { defineService } from "../define.mjs";

export const lyricsV1 = defineService("lyrics/v1", {
  methods: { lookup: { timeoutMs: 30_000 }, sources: true },
  events: { changed: true },
});
