import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { UsageSettingsGroup } from "../UsageSettingsGroup";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "agentRings">();

sections.add({ id: "agents.usage", category: "agentRings", order: 40, component: UsageSettingsGroup }, OWNER);
