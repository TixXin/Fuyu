import { useEffect, useState, useSyncExternalStore } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { DEFAULT_SETTINGS } from "../../lib/settings/settings";
import type { IslandSettings } from "../../lib/settings/types";
import { AboutHero } from "../../features/updater/AboutHero";
import { UpdateDiagnosticsRow } from "../../features/updater/UpdateDiagnosticsRow";
import { WhatsNew } from "../../features/updater/WhatsNew";
import { useOpenInBrowser } from "../../features/updater/useOpenInBrowser";
import { getUpdateState, subscribeToUpdate } from "../../features/updater/updaterController";
import { useTranslation } from "../../i18n";
import { openOnboardingWindow } from "../onboarding/api";
import { QuitIslandRow } from "./QuitIslandRow";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

const CONFIRM_TIMEOUT_MS = 4_000;

type AboutSectionProps = { onSettingsChange: (settings: IslandSettings) => void };

type AboutTabPage = "about" | "aboutChangelog" | "aboutHelp";

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

function Colophon() {
  const text = useTranslation().settings.project;
  const version = useSyncExternalStore(subscribeToUpdate, () => getUpdateState().version);
  const { failed, onClick } = useOpenInBrowser();
  return (
    <>
      <p className="about-colophon">
        {text.colophon(version)}
        {" · "}
        <a href={text.logoCallUrl} target="_blank" rel="noopener noreferrer" title={text.logoCall} onClick={onClick}>{text.logoCallLink}</a>
      </p>
      {failed && <p className="project-link-error" role="alert">{text.openFailed}</p>}
    </>
  );
}

const sections = settingsSections<AboutSectionProps, AboutTabPage>();

export function AboutSettingsPage({ tab, ...props }: AboutSectionProps & { tab: AboutTabPage }) {
  return (
    <div className="about-page">
      {tab === "about" && (
        <>
          <AboutHero />
          <WhatsNew />
        </>
      )}
      <SlotView slot={sections} group={tab} props={props} />
      {tab === "about" && <SystemSection onSettingsChange={props.onSettingsChange} />}
      {tab === "aboutHelp" && <HelpSection />}
      <Colophon />
    </div>
  );
}
