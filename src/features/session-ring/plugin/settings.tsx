import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { RingSettingsGroup } from "../RingSettingsGroup";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "agents">();

sections.add({ id: "agents.session-ring", category: "agents", order: 45, component: RingSettingsGroup }, OWNER);
