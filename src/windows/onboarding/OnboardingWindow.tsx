import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import { activeTone } from "../../lib/theme/themeMode";
import { useIslandSettings } from "../../lib/settings/useIslandSettings";
import { setBuiltinConfig, switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useSettingsWithBuiltinSwitches } from "../../features/plugin-kernel/useLegacySwitches";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslation } from "../../i18n";
import { settingsWindowOpening } from "../settings/api";
import type { SettingsFocusSection } from "../settings/storage";
import { useLaunchAtStartup } from "../settings/useLaunchAtStartup";
import { AgentCardsAct } from "./AgentCardsAct";
import { AgentConnectAct } from "./AgentConnectAct";
import { showOnboardingWindow } from "./api";
import { clampIndex, resolveExtensions, resolveMainSteps, resolveSetupSteps, type OnboardingFlowContext } from "./flow";
import { HelloAct } from "./HelloAct";
import { OnboardingHeader } from "./OnboardingHeader";
import { OutfitAct } from "./OutfitAct";
import { NO_ANSWER, enabledModules, moduleSwitchChanges, withModules, type OnboardingModule } from "./personas";
import { cardPlacement } from "./placement";
import { neededPermissions, PermissionsAct } from "./PermissionsAct";
import { PlayAct } from "./PlayAct";
import { PushAct } from "./push/PushAct";
import { PUSH_STEPS } from "./push/plan";
import { ReleaseAct } from "./ReleaseAct";
import { ShapeAct } from "./ShapeAct";
import { Spotlight } from "./Spotlight";
import { endIslandDemo, requestIslandWelcome } from "./storage";
import { useCardRect } from "./useCardRect";
import { useDemoHeartbeat } from "./useDemoHeartbeat";
import { useIslandSpot } from "./useIslandSpot";
import { useRecommendedBundle } from "./useRecommendedBundle";
import "./OnboardingWindow.css";
import { isMacOS } from "../../lib/platform";

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
  const [storedSettings, setSettings] = useIslandSettings();
  const plugins = useBuiltinPlugins();
  const settings = useSettingsWithBuiltinSwitches(storedSettings);
  const [clipboard, updateClipboard] = useClipboardSettings();
  const [launchAtStartup, updateLaunchAtStartup] = useLaunchAtStartup();
  const [index, setIndex] = useState(0);
  const [inSetup, setInSetup] = useState(false);
  const [setupIndex, setSetupIndex] = useState(0);
  const [pushStep, setPushStep] = useState(0);
  const [agentSetupDone, setAgentSetupDone] = useState(false);
  const [answer, setAnswer] = useState(NO_ANSWER);
  const light = activeTone(settings.themeMode, useSystemDark()) === "light";
  const modules = useMemo(() => enabledModules(settings, clipboard.enabled, plugins), [settings, clipboard.enabled, plugins]);
  const permissionKinds = useMemo(() => (isMacOS ? neededPermissions(modules) : []), [modules]);
  const bundle = useRecommendedBundle();
  const flowCtx: OnboardingFlowContext = useMemo(() => ({ isMacOS, modules, permissionKinds, bundle }), [modules, permissionKinds, bundle]);
  const mainSteps = useMemo(() => resolveMainSteps(flowCtx), [flowCtx]);
  const setupSteps = useMemo(() => resolveSetupSteps(flowCtx), [flowCtx]);
  const extensions = useMemo(() => resolveExtensions(flowCtx), [flowCtx]);
  const activeSetup = inSetup && setupSteps.length > 0;
  const mainIndex = clampIndex(index, mainSteps.length);
  const currentMain = mainSteps[mainIndex];
  const currentSetupIndex = clampIndex(setupIndex, setupSteps.length);
  const currentSetup = activeSetup ? setupSteps[currentSetupIndex] : null;
  const currentStep = currentSetup ?? currentMain;
  const lastMain = !activeSetup && currentMain.id === "release";
  const lastSetup = activeSetup && currentSetupIndex === setupSteps.length - 1 && (currentSetup?.id !== "push" || pushStep >= PUSH_STEPS - 1);
  const spot = useIslandSpot();
  const viewport = useViewport();
  const card = useRef<HTMLDivElement | null>(null);
  const placement = cardPlacement(spot, viewport, currentStep.layout, activeSetup || currentStep.spotlight === "off");
  useCardRect(card, `${currentStep.id}:${placement.left}:${placement.top}:${placement.width}:${activeSetup ? "setup" : "main"}`);
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

  const finish = () => {
    requestIslandWelcome("ready");
    closeGuide();
  };

  const exitSetup = (markDone: boolean) => {
    if (markDone) setAgentSetupDone(true);
    setInSetup(false);
    setPushStep(0);
    setIndex(Math.max(0, mainSteps.length - 1));
  };

  const forward = () => {
    if (activeSetup) {
      if (currentSetup?.id === "push" && pushStep < PUSH_STEPS - 1) {
        setPushStep(pushStep + 1);
        return;
      }
      if (currentSetupIndex < setupSteps.length - 1) {
        setSetupIndex(currentSetupIndex + 1);
        setPushStep(0);
        return;
      }
      exitSetup(true);
      return;
    }
    if (lastMain) finish();
    else setIndex(Math.min(mainSteps.length - 1, mainIndex + 1));
  };

  const backward = () => {
    if (activeSetup) {
      if (currentSetup?.id === "push" && pushStep > 0) {
        setPushStep(pushStep - 1);
        return;
      }
      if (currentSetupIndex > 0) {
        setSetupIndex(currentSetupIndex - 1);
        setPushStep(0);
        return;
      }
      exitSetup(false);
      return;
    }
    setIndex(Math.max(0, mainIndex - 1));
  };

  const skipCurrentStep = () => {
    if (activeSetup) {
      if (currentSetupIndex < setupSteps.length - 1) {
        setSetupIndex(currentSetupIndex + 1);
        setPushStep(0);
      } else {
        exitSetup(true);
      }
      return;
    }
    setIndex(Math.min(mainSteps.length - 1, mainIndex + 1));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeGuide();
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        forward();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        backward();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const changeModules = (next: ReadonlySet<OnboardingModule>) => {
    if (!plugins) {
      setSettings(withModules(storedSettings, next));
    } else {
      const changes = moduleSwitchChanges(modules, next);
      for (const [id, enabled] of changes.plugins) {
        void switchBuiltinPlugin(id, enabled).catch((error: unknown) => console.error(`Could not switch the built-in plugin ${id}`, error));
      }
      if (changes.mail !== undefined) {
        void setBuiltinConfig("messages", "mail", changes.mail).catch((error: unknown) => console.error("Could not switch the mail source", error));
      }
    }
    if (next.has("clipboard") !== clipboard.enabled) void updateClipboard({ ...clipboard, enabled: next.has("clipboard") });
  };

  const openAgentSetup = () => {
    if (setupSteps.length === 0) return;
    setSetupIndex(0);
    setPushStep(0);
    setInSetup(true);
  };

  const leaveForSettings = (section?: SettingsFocusSection, bundleId?: string) => void settingsWindowOpening(section, bundleId).then(finish);
  const cardStyle: CSSProperties = { left: placement.left, width: placement.width, top: placement.top, maxHeight: placement.maxHeight };
  const primaryLabel = lastMain ? text.release.finish : lastSetup ? text.doneSetup : !activeSetup && currentMain.id === "hello" ? text.startTour : text.next;

  return (
    <main className={`onboarding stage--font-${settings.fontFamily}${light ? " island-light onboarding--light" : ""}`} data-act={currentStep.id} data-mode={activeSetup ? "setup" : "main"}>
      <IconButtonTooltip scope=".onboarding" />
      <Spotlight spot={spot} mode={currentStep.spotlight} />
      <div className={currentStep.layout === "wide" ? "onboarding__card onboarding__card--wide" : "onboarding__card"} ref={card} style={cardStyle} role="dialog" aria-label={text.windowTitle}>
        {activeSetup ? (
          <OnboardingHeader
            mode="setup"
            steps={setupSteps}
            index={currentSetupIndex}
            onJump={(at) => {
              setSetupIndex(at);
              setPushStep(0);
            }}
            onBackToSummary={() => exitSetup(false)}
            onClose={closeGuide}
          />
        ) : (
          <OnboardingHeader mode="main" steps={mainSteps} index={mainIndex} onJump={setIndex} onClose={closeGuide} />
        )}
        <section className="onboarding__body" key={currentStep.id}>
          {!spot && !activeSetup && <p className="onboarding__notice">{isMacOS ? text.noIslandMac : text.noIsland}</p>}
          {currentStep.id === "hello" && <HelloAct />}
          {currentStep.id === "shape" && <ShapeAct settings={settings} onSettingsChange={setSettings} />}
          {currentStep.id === "outfit" && <OutfitAct modules={modules} answer={answer} onAnswerChange={setAnswer} onModulesChange={changeModules} />}
          {currentStep.id === "permissions" && <PermissionsAct kinds={permissionKinds} />}
          {currentStep.id === "play" && (
            <PlayAct
              settings={settings}
              modules={modules}
              clipboard={clipboard}
              islandOpen={spot?.expanded ?? false}
              onSettingsChange={setSettings}
              onClipboardChange={(next) => void updateClipboard(next)}
            />
          )}
          {currentStep.id === "release" && (
            <ReleaseAct
              extensions={extensions}
              bundle={bundle}
              agentSetupDone={agentSetupDone}
              launchAtStartup={launchAtStartup}
              onLaunchAtStartupChange={(enabled) => void updateLaunchAtStartup(enabled)}
              onOpenAgentSetup={openAgentSetup}
              onLeaveForSettings={leaveForSettings}
            />
          )}
          {currentStep.id === "agentCards" && <AgentCardsAct settings={settings} onSettingsChange={setSettings} />}
          {currentStep.id === "agentConnect" && <AgentConnectAct settings={settings} onSettingsChange={setSettings} />}
          {currentStep.id === "push" && <PushAct step={pushStep} onSkip={() => exitSetup(true)} />}
        </section>
        <footer className="onboarding__footer">
          {lastMain ? <span className="onboarding__esc">{text.escHint}</span> : <button className="onboarding__button onboarding__button--quiet" type="button" onClick={closeGuide}>{text.exit}</button>}
          <div className="onboarding__nav">
            {(activeSetup || mainIndex > 0) && <button className="onboarding__button" type="button" onClick={backward}>{text.back}</button>}
            {currentStep.skippable && !(currentStep.id === "push" && pushStep >= PUSH_STEPS - 1) && (
              <button className="onboarding__button onboarding__button--quiet" type="button" onClick={skipCurrentStep}>
                {text.skipStep}
              </button>
            )}
            <button className="onboarding__button onboarding__button--primary" type="button" onClick={forward}>
              {primaryLabel}
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
