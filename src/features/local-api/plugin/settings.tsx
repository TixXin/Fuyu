import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { LocalApiSettings, type LocalApiSettingsProps } from "../LocalApiSettings";
import { OWNER } from "./owner.ts";

settingsSections<LocalApiSettingsProps, "generalApi">().add({ id: "generalApi.localApi", category: "generalApi", order: 10, component: LocalApiSettings }, OWNER);
