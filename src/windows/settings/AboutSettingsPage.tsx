import { useEffect, useState, useSyncExternalStore } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { DEFAULT_SETTINGS } from "../../features/appearance/settings";
import type { IslandSettings } from "../../features/appearance/types";
import { AboutHero } from "../../features/updater/AboutHero";
import { ProjectLinksSection } from "../../features/updater/ProjectSettingsSection";
import { UpdateDiagnosticsRow } from "../../features/updater/UpdateDiagnosticsRow";
import { getUpdateState, subscribeToUpdate } from "../../features/updater/updaterController";
import { UpdateSettingsSection } from "../../features/updater/UpdateSettingsSection";
import { VersionHistory } from "../../features/updater/VersionHistory";
import { useTranslation } from "../../i18n";
import { openOnboardingWindow } from "../onboarding/api";
import { QuitIslandRow } from "./QuitIslandRow";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

const CONFIRM_TIMEOUT_MS = 4_000;

type AboutSectionProps = { onSettingsChange: (settings: IslandSettings) => void };

function HistorySection() {
  return <VersionHistory />;
}

function HelpSection() {
  const text = useTranslation().settings.project;
  return (
    <SettingsGroup title={text.helpTitle}>
      <SettingsRow
        title={text.guide}
        description={text.guideHint}
        control={<SettingsLinkButton onClick={openOnboardingWindow}>{text.guideAction}</SettingsLinkButton>}
      />
      <UpdateDiagnosticsRow />
    </SettingsGroup>
  );
}

function SystemSection({ onSettingsChange }: AboutSectionProps) {
  const text = useTranslation().settings.project;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timeout = window.setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [confirming]);

  return (
    <div className="about-danger">
      <SettingsGroup title={text.systemTitle}>
        <SettingsRow
          title={text.resetAll}
          description={text.resetAllHint}
          control={
            confirming ? (
              <>
                <SettingsLinkButton onClick={() => setConfirming(false)}>{text.resetAllCancel}</SettingsLinkButton>
                <SettingsLinkButton
                  tone="danger"
                  onClick={() => {
                    setConfirming(false);
                    onSettingsChange(DEFAULT_SETTINGS);
                  }}
                >
                  {text.resetAllConfirm}
                </SettingsLinkButton>
              </>
            ) : (
              <SettingsLinkButton tone="danger" onClick={() => setConfirming(true)}>{text.resetAllAction}</SettingsLinkButton>
            )
          }
        />
        <QuitIslandRow />
      </SettingsGroup>
    </div>
  );
}

const sections = settingsSections<AboutSectionProps, "about">();

sections.add({ id: "about.updates", category: "about", order: 10, component: UpdateSettingsSection });
sections.add({ id: "about.history", category: "about", order: 20, component: HistorySection });
sections.add({ id: "about.links", category: "about", order: 30, component: ProjectLinksSection });
sections.add({ id: "about.help", category: "about", order: 40, component: HelpSection });
sections.add({ id: "about.system", category: "about", order: 50, component: SystemSection });

export function AboutSettingsPage(props: AboutSectionProps) {
  const text = useTranslation().settings.project;
  const version = useSyncExternalStore(subscribeToUpdate, () => getUpdateState().version);

  return (
    <>
      <AboutHero />
      <SlotView slot={sections} group="about" props={props} />
      <p className="about-colophon">{text.colophon(version)}</p>
    </>
  );
}
