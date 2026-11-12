import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X } from "lucide-react";
import { activeTone } from "../../features/appearance/themeMode";
import { useIslandSettings } from "../../features/appearance/useIslandSettings";
import { useResolvedTheme, useSystemDark } from "../../features/appearance/useResolvedTheme";
import { useWindowAccent } from "../../features/appearance/useWindowAccent";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslation } from "../../i18n";
import { useLaunchAtStartup } from "../settings/useLaunchAtStartup";
import { flyOnboardingToIsland, showOnboardingWindow } from "./api";
import { LandingAct } from "./LandingAct";
import { OutfitAct } from "./OutfitAct";
import { enabledModules, withModules, type OnboardingModule } from "./personas";
import { PlayAct } from "./PlayAct";
import { ReleaseAct } from "./ReleaseAct";
import { ShapeAct } from "./ShapeAct";
import { requestIslandWelcome } from "./storage";
import "./OnboardingWindow.css";

const ACTS = ["landing", "shape", "outfit", "play", "release"] as const;

/** How long the guide takes to shrink into the island (OnboardingWindow.css, onboarding_window/mod.rs). */
const FLY_MS = 620;

function closeWindow() {
  void getCurrentWindow().close().catch((error: unknown) => console.error("Failed to close the onboarding window", error));
}

/** Shown once painted, like the settings window, so it never appears empty. */
function useShowWhenPainted() {
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
}

/**
 * The first-run guide (?window=onboarding): five short acts on a small desktop whose island is
 * drawn from the settings being chosen. Every choice is saved as it is made, through the same
 * storage as the settings window, so closing at any act keeps what was chosen. The last act flies
 * the window into the real island, which then greets the user.
 */
export function OnboardingWindow() {
  const t = useTranslation();
  const text = t.onboarding;
  const [settings, setSettings] = useIslandSettings();
  const shown = useResolvedTheme(settings);
  const [clipboard, updateClipboard] = useClipboardSettings();
  const [launchAtStartup, updateLaunchAtStartup] = useLaunchAtStartup();
  const [index, setIndex] = useState(0);
  const [flying, setFlying] = useState(false);
  const act = ACTS[index];
  const last = index === ACTS.length - 1;
  const light = activeTone(settings.themeMode, useSystemDark()) === "light";
  const modules = enabledModules(settings, clipboard.enabled);
  useWindowAccent(settings);
  useShowWhenPainted();

  useEffect(() => {
    void getCurrentWindow().setTitle(text.windowTitle).catch((error) => console.error("Failed to set the onboarding window title", error));
  }, [text.windowTitle]);

  const changeModules = (next: ReadonlySet<OnboardingModule>) => {
    setSettings(withModules(settings, next));
    if (next.has("clipboard") !== clipboard.enabled) void updateClipboard({ ...clipboard, enabled: next.has("clipboard") });
  };
  const changeClipboard = (next: typeof clipboard) => void updateClipboard(next);

  const release = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      requestIslandWelcome();
      closeWindow();
      return;
    }
    setFlying(true);
    void flyOnboardingToIsland(FLY_MS).catch((error: unknown) => {
      console.error("Failed to fly the onboarding window to the island", error);
      closeWindow();
    });
    window.setTimeout(requestIslandWelcome, FLY_MS - 80);
  };

  const stageClass = ["onboarding", `stage--font-${settings.fontFamily}`, light && "island-light onboarding--light", flying && "onboarding--flying"]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={stageClass} data-act={act}>
      <div className="onboarding__card">
        <header className="onboarding__bar" data-tauri-drag-region>
          <span className="onboarding__progress" role="img" aria-label={text.stepOf(index + 1, ACTS.length)} data-tauri-drag-region>
            {ACTS.map((name, at) => (
              <span key={name} className={at === index ? "onboarding__dot onboarding__dot--active" : at < index ? "onboarding__dot onboarding__dot--done" : "onboarding__dot"} />
            ))}
          </span>
          <button className="onboarding__close" type="button" aria-label={text.close} onClick={closeWindow}>
            <X size={15} strokeWidth={1.4} aria-hidden="true" />
          </button>
        </header>
        <section className="onboarding__body" key={act}>
          {act === "landing" && <LandingAct settings={shown} modules={modules} onBegin={() => setIndex(1)} />}
          {act === "shape" && <ShapeAct settings={settings} shown={shown} modules={modules} onSettingsChange={setSettings} />}
          {act === "outfit" && <OutfitAct shown={shown} modules={modules} onModulesChange={changeModules} />}
          {act === "play" && (
            <PlayAct settings={settings} shown={shown} modules={modules} clipboard={clipboard} onSettingsChange={setSettings} onClipboardChange={changeClipboard} />
          )}
          {act === "release" && (
            <ReleaseAct shown={shown} modules={modules} launchAtStartup={launchAtStartup} onLaunchAtStartupChange={(enabled) => void updateLaunchAtStartup(enabled)} />
          )}
        </section>
        <footer className="onboarding__footer">
          {last ? <span /> : <button className="onboarding__button onboarding__button--quiet" type="button" onClick={closeWindow}>{text.skip}</button>}
          <div className="onboarding__nav">
            {index > 0 && <button className="onboarding__button" type="button" onClick={() => setIndex(index - 1)}>{text.back}</button>}
            <button className="onboarding__button onboarding__button--primary" type="button" onClick={() => (last ? release() : setIndex(index + 1))}>
              {last ? text.release.finish : text.next}
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
