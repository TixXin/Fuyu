import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { LocalApiSettings } from "../LocalApiSettings";
import { OWNER } from "./owner.ts";

settingsSections<object, "generalApi">().add({ id: "generalApi.localApi", category: "generalApi", order: 10, component: LocalApiSettings }, OWNER);
