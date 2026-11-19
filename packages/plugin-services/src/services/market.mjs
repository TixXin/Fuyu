import { defineService } from "../define.mjs";

export const marketV1 = defineService("market/v1", {
  methods: {
    catalog: true,
    refresh: true,
    details: true,
    media: true,
    inspectPackage: true,
    installMarket: true,
    installFile: true,
    setManualAllowed: true,
    setEnabled: true,
    uninstall: true,
  },
  events: { changed: true },
});
