import { defineService } from "../define.mjs";

export const messagesV1 = defineService("messages/v1", {
  methods: { sources: true, notify: true, clear: true },
  events: { changed: true, arrived: true, action: true },
});
