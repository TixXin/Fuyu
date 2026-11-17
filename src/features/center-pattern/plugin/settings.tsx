import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { CenterPatternSettingsGroup } from "../CenterPatternSettingsGroup";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "appearance">();

sections.add({ id: "appearance.center-pattern", category: "appearance", order: 35, component: CenterPatternSettingsGroup }, OWNER);
