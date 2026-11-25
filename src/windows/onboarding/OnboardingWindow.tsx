import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import { JellyfishStyleContext } from "../../components/jellyfish/jellyfishStyleContext";
import { previewSamples } from "../../features/agent-status/reminder-settings/previewSamples";
import { activeTone } from "../../lib/theme/themeMode";
import type { IslandForm } from "../../lib/settings/types";
import { useIslandSettings } from "../../lib/settings/useIslandSettings";
import { setBuiltinConfig, switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useSettingsWithBuiltinSwitches } from "../../features/plugin-kernel/useLegacySwitches";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslation } from "../../i18n";
import { settingsWindowOpening } from "../settings/api";
import { useIslandDockEdge } from "../settings/sections/useIslandDockEdge";
import { useIslandTaskbar } from "../settings/sections/useIslandTaskbar";
import type { SettingsFocusSection } from "../settings/storage";
import { useLaunchAtStartup } from "../settings/useLaunchAtStartup";
import { AgentCardsAct } from "./AgentCardsAct";
import { AgentConnectAct } from "./AgentConnectAct";
import { DirectorHud } from "./DirectorHud";
import {
  clampIndex,
  resolveExtensions,
  resolveMainSteps,
  resolveSetupSteps,
  resolveWhatsNewSteps,
  type OnboardingFlowContext,
  type OnboardingTrack,
} from "./flow";
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
import { consumeOnboardingLaunchMode, requestIslandWelcome } from "./storage";
import { useCardRect } from "./useCardRect";
import { useDemoHeartbeat } from "./useDemoHeartbeat";
import { useIslandSpot } from "./useIslandSpot";
import { useOnboardingDirector } from "./useOnboardingDirector";
import { closeOnboardingGuide, useOnboardingCleanup, useOnboardingKeyboard, useShowWhenPainted, useViewport } from "./useOnboardingShell";
import { useRecommendedBundle } from "./useRecommendedBundle";
import { WechatCommunityCorner } from "./WechatCommunityCorner";
import { WhatsNewFormsAct, WhatsNewNotesAct } from "./WhatsNewAct";
import "./OnboardingWindow.css";
import { isMacOS } from "../../lib/platform";

let greeted = false;

export function OnboardingWindow() {
  const t = useTranslation();
  const text = t.onboarding;
  const [storedSettings, setSettings] = useIslandSettings();
  const plugins = useBuiltinPlugins();
  const settings = useSettingsWithBuiltinSwitches(storedSettings);
  const [clipboard, updateClipboard] = useClipboardSettings();
  const [launchAtStartup, updateLaunchAtStartup] = useLaunchAtStartup();
  const [launch] = useState(() => consumeOnboardingLaunchMode());
  const [track, setTrack] = useState<OnboardingTrack>(() => launch.mode);
  const [index, setIndex] = useState(0);
  const [setupIndex, setSetupIndex] = useState(0);
  const [pushStep, setPushStep] = useState(0);
  const [agentSetupDone, setAgentSetupDone] = useState(false);
  const [answer, setAnswer] = useState(NO_ANSWER);
  const [qrZoomed, setQrZoomed] = useState(false);
  const [cornerRev, bumpCorner] = useReducer((n: number) => n + 1, 0);

  const light = activeTone(settings.themeMode, useSystemDark()) === "light";
  const modules = useMemo(() => enabledModules(settings, clipboard.enabled, plugins), [settings, clipboard.enabled, plugins]);
  const permissionKinds = useMemo(() => (isMacOS ? neededPermissions(modules) : []), [modules]);
  const bundle = useRecommendedBundle();
  const flowCtx: OnboardingFlowContext = useMemo(() => ({ isMacOS, modules, permissionKinds, bundle }), [modules, permissionKinds, bundle]);
  const mainSteps = useMemo(() => resolveMainSteps(flowCtx), [flowCtx]);
  const whatsNewSteps = useMemo(() => resolveWhatsNewSteps(flowCtx), [flowCtx]);
  const setupSteps = useMemo(() => resolveSetupSteps(flowCtx), [flowCtx]);
  const extensions = useMemo(() => resolveExtensions(flowCtx), [flowCtx]);

  const activeSetup = track === "setup" && setupSteps.length > 0;
  const activeWhatsNew = track === "whatsNew" && whatsNewSteps.length > 0;
  const mainIndex = clampIndex(index, mainSteps.length);
  const whatsNewIndex = clampIndex(index, whatsNewSteps.length);
  const currentSetupIndex = clampIndex(setupIndex, setupSteps.length);
  const currentStep = activeSetup ? setupSteps[currentSetupIndex] : activeWhatsNew ? whatsNewSteps[whatsNewIndex] : mainSteps[mainIndex];
  const lastMain = !activeSetup && !activeWhatsNew && currentStep.id === "release";
  const lastWhatsNew = activeWhatsNew && whatsNewIndex === whatsNewSteps.length - 1;
  const lastSetup = activeSetup && currentSetupIndex === setupSteps.length - 1 && (currentStep.id !== "push" || pushStep >= PUSH_STEPS - 1);

  const spot = useIslandSpot();
  const edge = useIslandDockEdge();
  const taskbar = useIslandTaskbar();
  const viewport = useViewport();
  const card = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const cornerRef = useRef<HTMLDivElement | null>(null);
  const hitTargets = useMemo(() => [card, hudRef, cornerRef], []);
  const placement = cardPlacement(spot, viewport, currentStep.layout, activeSetup || currentStep.spotlight === "off");
  const agentSamples = useMemo(() => previewSamples(t.settings.agentNotice.preview.sample), [t.settings.agentNotice.preview.sample]);
  const setIslandForm = useCallback((form: IslandForm) => setSettings((cur) => (cur.islandForm === form ? cur : { ...cur, islandForm: form })), [setSettings]);
  const director = useOnboardingDirector({
    autoPlay: Boolean(currentStep.autoDirector),
    skipInitialNotify: launch.mode === "firstRun",
    islandExpanded: spot ? spot.expanded : null,
    stepId: currentStep.id,
    islandForm: settings.islandForm,
    edge,
    taskbarAvailable: taskbar.available,
    taskbarDocked: taskbar.docked,
    agentsEnabled: modules.has("agents"),
    onSetIslandForm: setIslandForm,
    notifyTitle: text.director.notifyTitle,
    notifyBody: text.director.notifyBody,
    agentSamples,
  });

  useCardRect(hitTargets, `${currentStep.id}:${placement.left}:${placement.top}:${placement.width}:${track}:${qrZoomed}:${cornerRev}`, qrZoomed);
  useOnboardingCleanup(director.restoreAnchor);
  useWindowAccent(settings);
  useShowWhenPainted();
  useDemoHeartbeat();

  useEffect(() => {
    void getCurrentWindow().setTitle(text.windowTitle).catch((error) => console.error("Failed to set the onboarding window title", error));
  }, [text.windowTitle]);

  useEffect(() => {
    if (greeted || launch.mode !== "firstRun") return;
    greeted = true;
    requestIslandWelcome("hello");
  }, [launch.mode]);

  const closeGuide = () => {
    director.restoreAnchor();
    closeOnboardingGuide();
  };

  const finish = () => {
    if (!activeWhatsNew) requestIslandWelcome("ready");
    closeGuide();
  };

  const exitSetup = (markDone: boolean) => {
    if (markDone) setAgentSetupDone(true);
    setTrack("firstRun");
    setPushStep(0);
    setIndex(Math.max(0, mainSteps.length - 1));
  };

  const forward = () => {
    if (activeSetup) {
      if (currentStep.id === "push" && pushStep < PUSH_STEPS - 1) {
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
    if (activeWhatsNew) {
      if (lastWhatsNew) finish();
      else setIndex(Math.min(whatsNewSteps.length - 1, whatsNewIndex + 1));
      return;
    }
    if (lastMain) finish();
    else setIndex(Math.min(mainSteps.length - 1, mainIndex + 1));
  };

  const backward = () => {
    if (activeSetup) {
      if (currentStep.id === "push" && pushStep > 0) {
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
    setIndex(Math.max(0, (activeWhatsNew ? whatsNewIndex : mainIndex) - 1));
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
    const maxLen = activeWhatsNew ? whatsNewSteps.length : mainSteps.length;
    setIndex(Math.min(maxLen - 1, (activeWhatsNew ? whatsNewIndex : mainIndex) + 1));
  };

  useOnboardingKeyboard({
    qrZoomed,
    onCloseQr: () => setQrZoomed(false),
    onCloseGuide: closeGuide,
    onForward: forward,
    onBackward: backward,
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
    director.pause("paused");
    setSetupIndex(0);
    setPushStep(0);
    setTrack("setup");
  };

  const leaveForSettings = (section?: SettingsFocusSection, bundleId?: string) => void settingsWindowOpening(section, bundleId).then(finish);
  const cardStyle: CSSProperties = { left: placement.left, width: placement.width, top: placement.top, maxHeight: placement.maxHeight };
  const primaryLabel = lastMain
    ? text.release.finish
    : lastWhatsNew
      ? text.whatsNew.finish
      : lastSetup
        ? text.doneSetup
        : !activeSetup && !activeWhatsNew && currentStep.id === "hello"
          ? text.startTour
          : text.next;
  const showBack = activeSetup || (activeWhatsNew ? whatsNewIndex > 0 : mainIndex > 0);
  const showDirectorHud = !activeSetup && currentStep.id !== "permissions";

  return (
    <JellyfishStyleContext.Provider value={settings.jellyfishStyle}>
      <main
        className={`onboarding stage--font-${settings.fontFamily}${light ? " island-light onboarding--light" : ""}`}
        data-act={currentStep.id}
        data-mode={activeSetup ? "setup" : activeWhatsNew ? "whatsNew" : "main"}
      >
        <IconButtonTooltip scope=".onboarding" />
        <Spotlight spot={spot} mode={currentStep.spotlight} />
        {showDirectorHud && (
          <DirectorHud
            hudRef={hudRef}
            status={director.status}
            currentScene={director.currentScene}
            sceneIndex={director.sceneIndex}
            sceneCount={director.sceneCount}
            onToggle={director.togglePlay}
            onNext={director.nextScene}
          />
        )}
        <div className="onboarding__card" ref={card} style={cardStyle} role="dialog" aria-label={text.windowTitle}>
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
          ) : activeWhatsNew ? (
            <OnboardingHeader mode="whatsNew" steps={whatsNewSteps} index={whatsNewIndex} onJump={setIndex} onClose={closeGuide} />
          ) : (
            <OnboardingHeader mode="firstRun" steps={mainSteps} index={mainIndex} onJump={setIndex} onClose={closeGuide} />
          )}
          <section className="onboarding__body" key={currentStep.id}>
            {!spot && !activeSetup && <p className="onboarding__notice">{isMacOS ? text.noIslandMac : text.noIsland}</p>}
            {currentStep.id === "hello" && (
              <HelloAct
                settings={settings}
                onSettingsChange={setSettings}
                scenes={director.scenes}
                status={director.status}
                activeScene={director.activeScene}
                currentScene={director.currentScene}
                currentDurationMs={director.currentDurationMs}
                runToken={director.runToken}
                anchorDirty={director.anchorDirty}
                onSelectScene={director.selectScene}
                onPlayGroup={director.playGroup}
                onTogglePlay={director.togglePlay}
                onRestoreAnchor={director.restoreAnchor}
              />
            )}
            {currentStep.id === "shape" && (
              <ShapeAct
                settings={settings}
                onSettingsChange={setSettings}
                onPreviewMotion={director.previewMotion}
                onUserInteract={director.claimUserControl}
              />
            )}
            {currentStep.id === "outfit" && (
              <OutfitAct
                modules={modules}
                answer={answer}
                onAnswerChange={setAnswer}
                onModulesChange={changeModules}
                onPreviewPage={director.previewPage}
                onCollapsePreview={director.collapsePreview}
                onUserInteract={director.claimUserControl}
              />
            )}
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
                settings={settings}
                moduleCount={modules.size}
                extensions={extensions}
                bundle={bundle}
                agentSetupDone={agentSetupDone}
                launchAtStartup={launchAtStartup}
                onLaunchAtStartupChange={(enabled) => void updateLaunchAtStartup(enabled)}
                onOpenAgentSetup={openAgentSetup}
                onLeaveForSettings={leaveForSettings}
              />
            )}
            {currentStep.id === "whatsNewNotes" && (
              <WhatsNewNotesAct fromVersion={launch.fromVersion} onLeaveForSettings={leaveForSettings} />
            )}
            {currentStep.id === "whatsNewForms" && (
              <WhatsNewFormsAct
                settings={settings}
                onSettingsChange={setSettings}
                onUserInteract={director.claimUserControl}
                onLeaveForSettings={leaveForSettings}
              />
            )}
            {currentStep.id === "agentCards" && <AgentCardsAct settings={settings} onSettingsChange={setSettings} />}
            {currentStep.id === "agentConnect" && <AgentConnectAct settings={settings} onSettingsChange={setSettings} />}
            {currentStep.id === "push" && <PushAct step={pushStep} onSkip={() => exitSetup(true)} />}
          </section>
          <footer className="onboarding__footer">
            {lastMain || lastWhatsNew ? (
              <span className="onboarding__esc">{text.escHint}</span>
            ) : (
              <button className="onboarding__button onboarding__button--quiet" type="button" onClick={closeGuide}>
                {text.exit}
              </button>
            )}
            <div className="onboarding__nav">
              {showBack && (
                <button className="onboarding__button" type="button" onClick={backward}>
                  {text.back}
                </button>
              )}
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
        <WechatCommunityCorner cornerRef={cornerRef} visible={!activeSetup} zoomed={qrZoomed} onZoomChange={setQrZoomed} onBoundsChange={bumpCorner} />
      </main>
    </JellyfishStyleContext.Provider>
  );
}
