import { addSettingsCategory } from "../../../windows/settings/slots/categorySlot";
import { CalendarSettingsPage } from "../CalendarSettingsPage";

addSettingsCategory("calendar", ({ settings, onSettingsChange }) => <CalendarSettingsPage settings={settings} onSettingsChange={onSettingsChange} />);
