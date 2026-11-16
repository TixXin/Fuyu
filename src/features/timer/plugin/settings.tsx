import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { BreakRemindersGroup } from "../BreakRemindersGroup";

const sections = settingsSections<object, "behaviorAlerts">();

sections.add({ id: "behaviorAlerts.breaks", category: "behaviorAlerts", order: 20, component: BreakRemindersGroup });
