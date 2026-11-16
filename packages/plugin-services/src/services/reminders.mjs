import { defineService } from "../define.mjs";

export const remindersV1 = defineService("reminders/v1", {
  methods: { push: true },
});
