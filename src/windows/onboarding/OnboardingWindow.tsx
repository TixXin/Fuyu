import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X } from "lucide-react";
import { activeTone } from "../../features/appearance/themeMode";
import { useIslandSettings } from "../../features/appearance/useIslandSettings";
import { useSystemDark } from "../../features/appearance/useResolvedTheme";
import { useWindowAccent } from "../../features/appearance/useWindowAccent";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslation } from "../../i18n";
import { settingsWindowOpening } from "../settings/api";
import type { SettingsFocusSection } from "../settings/storage";
import { useLaunchAtStartup } from "../settings/useLaunchAtStartup";
import { showOnboardingWindow } from "./api";
import { HelloAct } from "./HelloAct";
import { OutfitAct } from "./OutfitAct";
import { NO_ANSWER, enabledModules, withModules, type OnboardingModule } from "./personas";
import { cardPlacement } from "./placement";
import { neededPermissions, PermissionsAct } from "./PermissionsAct";
import { PlayAct } from "./PlayAct";
import { ReleaseAct } from "./ReleaseAct";
import { ShapeAct } from "./ShapeAct";
import { Spotlight } from "./Spotlight";
import { endIslandDemo, requestIslandWelcome } from "./storage";
import { useCardRect } from "./useCardRect";
import { useDemoHeartbeat } from "./useDemoHeartbeat";
import { useIslandSpot } from "./useIslandSpot";
import "./OnboardingWindow.css";
import { isMacOS } from "../../lib/platform";

const ACTS = ["hello", "shape", "outfit", "play", "permissions", "release"] as const;
type Act = (typeof ACTS)[number];

let greeted = false;

function closeGuide() {
  endIslandDemo();
  void getCurrentWindow().close().catch((error: unknown) => console.error("Failed to close the onboarding window", error));
}

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

function useViewport() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export function OnboardingWindow() {
  const t = useTranslation();
  const text = t.onboarding;
  const [settings, setSettings] = useIslandSettings();
  const [clipboard, updateClipboard] = useClipboardSettings();
  const [launchAtStartup, updateLaunchAtStartup] = useLaunchAtStartup();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(NO_ANSWER);
  const light = activeTone(settings.themeMode, useSystemDark()) === "light";
  const modules = enabledModules(settings, clipboard.enabled);
  const permissionKinds = isMacOS ? neededPermissions(modules) : [];
  const acts: readonly Act[] = ACTS.filter((name) => name !== "permissions" || permissionKinds.length > 0);
  const act = acts[Math.min(index, acts.length - 1)];
  const last = act === "release";
  const spot = useIslandSpot();
  const viewport = useViewport();
  const card = useRef<HTMLDivElement | null>(null);
  const placement = cardPlacement(spot, viewport);
  useCardRect(card, `${act}:${placement.left}:${placement.top}:${placement.bottom}`);
  useWindowAccent(settings);
  useShowWhenPainted();
  useDemoHeartbeat();

  useEffect(() => {
    void getCurrentWindow().setTitle(text.windowTitle).catch((error) => console.error("Failed to set the onboarding window title", error));
  }, [text.windowTitle]);

  useEffect(() => {
    if (greeted) return;
    greeted = true;
    requestIslandWelcome("hello");
  }, []);

  useEffect(() => {
    const leave = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGuide();
    };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, []);

  const changeModules = (next: ReadonlySet<OnboardingModule>) => {
    setSettings(withModules(settings, next));
    if (next.has("clipboard") !== clipboard.enabled) void updateClipboard({ ...clipboard, enabled: next.has("clipboard") });
  };
  const finish = () => {
    requestIslandWelcome("ready");
    closeGuide();
  };
  const leaveForSettings = (section?: SettingsFocusSection) => void settingsWindowOpening(section).then(finish);
  const cardStyle: CSSProperties = { left: placement.left, width: placement.width, top: placement.top, bottom: placement.bottom, maxHeight: placement.maxHeight };

  return (
    <main className={`onboarding stage--font-${settings.fontFamily}${light ? " island-light onboarding--light" : ""}`} data-act={act}>
      <Spotlight spot={spot} />
      <div className="onboarding__card" ref={card} style={cardStyle} role="dialog" aria-label={text.windowTitle}>
        <header className="onboarding__bar">
          <span className="onboarding__progress" role="img" aria-label={text.stepOf(index + 1, acts.length)}>
            {acts.map((name, at) => (
              <span key={name} className={at === index ? "onboarding__dot onboarding__dot--active" : at < index ? "onboarding__dot onboarding__dot--done" : "onboarding__dot"} />
            ))}
          </span>
          <button className="onboarding__close" type="button" aria-label={text.close} onClick={closeGuide}>
            <X size={15} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </header>
        <section className="onboarding__body" key={act}>
          {!spot && <p className="onboarding__notice">{isMacOS ? text.noIslandMac : text.noIsland}</p>}
          {act === "hello" && <HelloAct />}
          {act === "shape" && <ShapeAct settings={settings} onSettingsChange={setSettings} />}
          {act === "outfit" && <OutfitAct modules={modules} answer={answer} onAnswerChange={setAnswer} onModulesChange={changeModules} />}
          {act === "play" && (
            <PlayAct
              settings={settings}
              modules={modules}
              clipboard={clipboard}
              islandOpen={spot?.expanded ?? false}
              onSettingsChange={setSettings}
              onClipboardChange={(next) => void updateClipboard(next)}
            />
          )}
          {act === "permissions" && <PermissionsAct kinds={permissionKinds} />}
          {act === "release" && (
            <ReleaseAct
              modules={modules}
              launchAtStartup={launchAtStartup}
              onLaunchAtStartupChange={(enabled) => void updateLaunchAtStartup(enabled)}
              onLeaveForSettings={leaveForSettings}
            />
          )}
        </section>
        <footer className="onboarding__footer">
          {last ? <span className="onboarding__esc">{text.escHint}</span> : <button className="onboarding__button onboarding__button--quiet" type="button" onClick={closeGuide}>{text.skip}</button>}
          <div className="onboarding__nav">
            {index > 0 && <button className="onboarding__button" type="button" onClick={() => setIndex(index - 1)}>{text.back}</button>}
            <button className="onboarding__button onboarding__button--primary" type="button" onClick={() => (last ? finish() : setIndex(index + 1))}>
              {last ? text.release.finish : text.next}
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
