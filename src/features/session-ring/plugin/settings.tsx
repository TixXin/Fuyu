import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { RingSettingsGroup } from "../RingSettingsGroup";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "agentRings">();

sections.add({ id: "agents.session-ring", category: "agentRings", order: 45, component: RingSettingsGroup }, OWNER);
