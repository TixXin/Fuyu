import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { LocalApiSettings } from "../LocalApiSettings";
import { OWNER } from "./owner.ts";

addSettingsCategory("generalApi", () => <LocalApiSettings />, OWNER);
