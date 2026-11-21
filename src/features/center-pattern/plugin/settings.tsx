import { islandItemStyleId, islandItemStyles } from "../../plugin-kernel/settingsSlots";
import { CenterPatternSettingsGroup } from "../CenterPatternSettingsGroup";
import { OWNER } from "./owner.ts";

islandItemStyles.add({ id: islandItemStyleId("center"), category: "islandLayout", order: 10, component: CenterPatternSettingsGroup }, OWNER);
