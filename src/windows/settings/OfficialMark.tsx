import { Check } from "lucide-react";
import { useTranslation } from "../../i18n";

export function OfficialMark() {
  const label = useTranslation().settings.pluginsV3.marketPage.card.officialTitle;
  return (
    <span className="plugin-verified" title={label} role="img" aria-label={label} data-official="true">
      <Check size={10} strokeWidth={3.2} aria-hidden="true" />
    </span>
  );
}
