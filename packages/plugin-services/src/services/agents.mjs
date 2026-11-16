import { defineService } from "../define.mjs";

export const agentsV1 = defineService("agents/v1", {
  methods: { sessions: true, usage: { timeoutMs: 60_000 }, focus: true, remoteHosts: true },
  events: { changed: true },
});
