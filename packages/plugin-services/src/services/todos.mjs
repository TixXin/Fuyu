import { defineService } from "../define.mjs";

export const todosV1 = defineService("todos/v1", {
  methods: { list: true, days: true, add: true, update: true, remove: true, note: true, setNote: true },
  events: { changed: true },
});
