import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { LocalApiSettings } from "../LocalApiSettings";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "general">();

sections.add({ id: "general.localApi", category: "general", order: 45, component: LocalApiSettings }, OWNER);
