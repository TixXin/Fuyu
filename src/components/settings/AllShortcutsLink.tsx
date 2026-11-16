import { SettingsLinkButton } from "./SettingsLinkButton";
import { useTranslation } from "../../i18n";

export function AllShortcutsLink({ onOpen }: { onOpen: () => void }) {
  const t = useTranslation();
  return <SettingsLinkButton onClick={onOpen}>{t.settings.shortcuts.allShortcuts}</SettingsLinkButton>;
}
