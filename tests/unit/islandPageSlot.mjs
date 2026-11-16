import { existsSync, readdirSync } from "node:fs";
import { pageSlot } from "../../src/windows/island/slots/pageSlot.ts";

const FEATURES = new URL("../../src/features/", import.meta.url);

for (const feature of readdirSync(FEATURES).sort()) {
  const file = new URL(`${feature}/plugin/page.ts`, FEATURES);
  if (!existsSync(file)) continue;
  const { islandPage } = await import(file.href);
  pageSlot.add({ ...islandPage, component: () => null });
}
