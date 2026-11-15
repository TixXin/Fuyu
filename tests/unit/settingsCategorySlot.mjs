import { BUILTIN_CATEGORIES, categorySlot } from "../../src/windows/settings/slots/categorySlot.ts";

for (const category of BUILTIN_CATEGORIES) categorySlot.add({ ...category, component: () => null });
