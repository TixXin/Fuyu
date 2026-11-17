import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { CenterPatternSettingsGroup } from "../CenterPatternSettingsGroup";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "appearanceCollapsed">();

sections.add({ id: "appearance.center-pattern", category: "appearanceCollapsed", order: 35, component: CenterPatternSettingsGroup }, OWNER);
