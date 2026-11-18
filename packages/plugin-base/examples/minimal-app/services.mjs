import { defineService } from "@fuyu/plugin-base/services";

export const notesV1 = defineService("notes/v1", {
  methods: {
    list: true,
    add: true,
  },
  events: {
    added: true,
  },
});
