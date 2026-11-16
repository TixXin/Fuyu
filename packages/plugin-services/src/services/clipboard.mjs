import { defineService } from "../define.mjs";

export const clipboardV1 = defineService("clipboard/v1", {
  methods: { history: true },
});
