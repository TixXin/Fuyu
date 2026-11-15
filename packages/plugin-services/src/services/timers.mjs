import { defineService } from "../define.mjs";

export const timersV1 = defineService("timers/v1", {
  methods: { list: true, start: true, pause: true, resume: true, extend: true, remove: true, dismissRinging: true },
  events: { changed: true, due: true },
});
