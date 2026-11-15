import { BUILTIN_PAGES, pageSlot } from "../../src/windows/island/slots/pageSlot.ts";

for (const page of BUILTIN_PAGES) pageSlot.add({ ...page, component: () => null });
