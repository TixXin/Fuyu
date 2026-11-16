import { addSettingsCategory } from "../../../windows/settings/slots/categorySlot";
import { ShelfSettingsPage } from "../ShelfSettingsPage";

addSettingsCategory("shelf", ({ settings, onSettingsChange }) => <ShelfSettingsPage settings={settings} onSettingsChange={onSettingsChange} />);
