import { islandItemStyleId, islandItemStyles, settingsSections } from "../../plugin-kernel/settingsSlots";
import { UsageSettingsGroup } from "../UsageSettingsGroup";
import { UsageStyleRows } from "../UsageStyleRows";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "agentRings">();

sections.add({ id: "agents.usage", category: "agentRings", order: 40, component: UsageSettingsGroup }, OWNER);
islandItemStyles.add({ id: islandItemStyleId("usage:"), category: "islandLayout", order: 10, component: UsageStyleRows }, OWNER);
