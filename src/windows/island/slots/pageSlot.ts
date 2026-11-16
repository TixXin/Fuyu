import { defineSlot, type IslandPageMeta } from "../../../features/plugin-kernel/slots.ts";
import type { IslandFeatures } from "../features";
import type { IslandPageProps } from "../IslandPages";
import type { BuiltinPage } from "../types";

type PageMeta = IslandPageMeta<IslandFeatures, BuiltinPage>;

export const pageSlot = defineSlot<IslandPageProps, PageMeta>("island.page/v1");
