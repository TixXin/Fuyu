import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X } from "lucide-react";
import { activeTone } from "../../features/appearance/themeMode";
import { useIslandSettings } from "../../features/appearance/useIslandSettings";
import { useSystemDark } from "../../features/appearance/useResolvedTheme";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslation } from "../../i18n";
import { useLaunchAtStartup } from "../settings/useLaunchAtStartup";
import { showOnboardingWindow } from "./api";
import { DoneStep } from "./DoneStep";
import { HabitsStep } from "./HabitsStep";
import { ModulesStep } from "./ModulesStep";
import { WelcomeStep } from "./WelcomeStep";
import "./OnboardingWindow.css";

const STEPS = ["welcome", "modules", "habits", "done"] as const;

// Same as .onboarding and .onboarding--light in OnboardingWindow.css, and the settings window's.
const DARK_FILL = "#131417";
const LIGHT_FILL = "#eceef2";

function closeWindow() {
  void getCurrentWindow().close().catch((error: unknown) => console.error("Failed to close the onboarding window", error));
}

/**
 * The first-run guide (?window=onboarding): four short steps over the settings a new user is most
 * likely to want different. Every choice is saved as it is made, the same way the settings window
 * saves it, so skipping or closing at any step keeps what was chosen and the defaults for the rest.
 */
export function OnboardingWindow() {
  const t = useTranslation();
  const text = t.onboarding;
  const [settings, setSettings] = useIslandSettings();
  const [clipboard, updateClipboard] = useClipboardSettings();
  const [launchAtStartup, updateLaunchAtStartup] = useLaunchAtStartup();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const light = activeTone(settings.themeMode, useSystemDark()) === "light";

  // Shown once painted, like the settings window, so it never appears empty.
  useEffect(() => {
    const show = () => void showOnboardingWindow().catch((error) => console.error("Failed to show the onboarding window", error));
    if (document.visibilityState === "hidden") {
      show();
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(show);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    void getCurrentWindow().setTitle(text.windowTitle).catch((error) => console.error("Failed to set the onboarding window title", error));
  }, [text.windowTitle]);

  useEffect(() => {
    const current = getCurrentWindow();
    const failed = (error: unknown) => console.error("Failed to set the onboarding window's tone", error);
    void current.setBackgroundColor(light ? LIGHT_FILL : DARK_FILL).catch(failed);
    void current.setTheme(light ? "light" : "dark").catch(failed);
  }, [light]);

  const titles = { welcome: text.welcome.title, modules: text.modules.title, habits: text.habits.title, done: text.done.title };
  const leads = { welcome: text.welcome.lead, modules: text.modules.lead, habits: text.habits.lead, done: null };

  return (
    <main className={`onboarding stage--font-${settings.fontFamily}${light ? " island-light onboarding--light" : ""}`} data-step={step}>
      <header className="onboarding__bar" data-tauri-drag-region>
        <span className="onboarding__progress" aria-label={text.stepOf(index + 1, STEPS.length)} data-tauri-drag-region>
          {STEPS.map((name, at) => (
            <span key={name} className={at === index ? "onboarding__dot onboarding__dot--active" : at < index ? "onboarding__dot onboarding__dot--done" : "onboarding__dot"} />
          ))}
        </span>
        <button className="onboarding__close" type="button" aria-label={text.close} onClick={closeWindow}>
          <X size={15} strokeWidth={1.4} aria-hidden="true" />
        </button>
      </header>
      <section className="onboarding__body">
        <h1 className="onboarding__title">{titles[step]}</h1>
        {leads[step] && <p className="onboarding__lead">{leads[step]}</p>}
        <div className="onboarding__content">
          {step === "welcome" && <WelcomeStep settings={settings} onSettingsChange={setSettings} />}
          {step === "modules" && <ModulesStep settings={settings} clipboard={clipboard} onSettingsChange={setSettings} onClipboardChange={(next) => void updateClipboard(next)} />}
          {step === "habits" && (
            <HabitsStep
              settings={settings}
              clipboard={clipboard}
              launchAtStartup={launchAtStartup}
              onSettingsChange={setSettings}
              onClipboardChange={(next) => void updateClipboard(next)}
              onLaunchAtStartupChange={(enabled) => void updateLaunchAtStartup(enabled)}
            />
          )}
          {step === "done" && <DoneStep settings={settings} />}
        </div>
      </section>
      <footer className="onboarding__footer">
        {last ? <span /> : <button className="onboarding__button onboarding__button--quiet" type="button" onClick={closeWindow}>{text.skip}</button>}
        <div className="onboarding__nav">
          {index > 0 && <button className="onboarding__button" type="button" onClick={() => setIndex(index - 1)}>{text.back}</button>}
          <button
            className="onboarding__button onboarding__button--primary"
            type="button"
            onClick={() => (last ? closeWindow() : setIndex(index + 1))}
          >
            {last ? text.finish : text.next}
          </button>
        </div>
      </footer>
    </main>
  );
}
