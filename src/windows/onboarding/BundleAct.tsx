import { Layers } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { bundleText, type RecommendedBundle } from "../../lib/onboarding-bundle/recommend";
import { ActHeading } from "./ActHeading";
import "./BundleAct.css";

export function BundleAct({ bundle, onOpen }: { bundle: RecommendedBundle; onOpen: (id: string) => void }) {
  const text = useTranslation().onboarding.bundle;
  const { locale } = useLocale();
  const description = bundleText(bundle.description, locale);

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <div className="onboarding-bundle" data-onboarding-bundle={bundle.id}>
        <div className="onboarding-bundle__name">
          <Layers size={16} aria-hidden="true" />
          {bundleText(bundle.displayName, locale)}
        </div>
        {description ? <p className="onboarding-bundle__desc">{description}</p> : null}
        <div className="onboarding-bundle__label">{text.contains}</div>
        <ul className="onboarding-bundle__members">
          {bundle.members.map((member) => (
            <li key={member.name} className="onboarding-bundle__member">{bundleText(member.displayName, locale)}</li>
          ))}
        </ul>
      </div>
      <div className="onboarding-release__links onboarding-bundle__actions">
        <button className="onboarding-release__link" type="button" data-action="onboarding-bundle-open" onClick={() => onOpen(bundle.id)}>
          <Layers size={16} aria-hidden="true" />
          {text.open}
        </button>
      </div>
      <p className="onboarding-release__later onboarding-bundle__later">{text.later}</p>
    </>
  );
}
