import { defineService } from "../define.mjs";

export const screenshotActionsV1 = defineService("screenshot.actions/v1", {
  methods: { list: true, run: { timeoutMs: 60_000 } },
  events: { changed: true },
});
