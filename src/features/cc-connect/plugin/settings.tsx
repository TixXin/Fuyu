import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { CcConnectSettings } from "../CcConnectSettings";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "agentAlerts">();

sections.add({ id: "agentAlerts.ccConnect", category: "agentAlerts", order: 30, component: CcConnectSettings }, OWNER);
