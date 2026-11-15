import { defineService } from "../define.mjs";

export const translatorV1 = defineService("translator/v1", {
  methods: { translate: { timeoutMs: 60_000 }, rewrite: { timeoutMs: 120_000, progress: true }, engines: true },
});
