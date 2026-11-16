import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { UsageSettingsGroup } from "../UsageSettingsGroup";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "agents">();

sections.add({ id: "agents.usage", category: "agents", order: 40, component: UsageSettingsGroup }, OWNER);
