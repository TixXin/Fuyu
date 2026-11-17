import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { CcConnectSettings } from "../CcConnectSettings";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "agentPush">();

sections.add({ id: "agentAlerts.ccConnect", category: "agentPush", order: 30, component: CcConnectSettings }, OWNER);
