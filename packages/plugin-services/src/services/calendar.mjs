import { defineService } from "../define.mjs";

export const calendarV1 = defineService("calendar/v1", {
  methods: { events: { timeoutMs: 60_000 }, sources: true },
  events: { changed: true },
});
