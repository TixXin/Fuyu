import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { quitIsland } from "./api";

export function QuitIslandRow() {
  const text = useTranslation().settings.project;
  return (
    <SettingsRow
      title={text.quit}
      description={isMacOS ? text.quitHintMac : text.quitHint}
      control={
        <SettingsLinkButton tone="danger" onClick={() => void quitIsland().catch((error) => console.error("Failed to quit the island", error))}>
          {text.quitAction}
        </SettingsLinkButton>
      }
    />
  );
}
