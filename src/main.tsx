import "./lib/copyRenamedKeys";
import { devRootOptions, markCrashed, markMounted } from "./devReload";
import { blockBrowserDefaults } from "./lib/browserDefaults";
import { isMacOS } from "./lib/platform";
import React, { type ReactNode } from "react";
import ReactDOM, { type RootOptions } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/base.css";
import { I18nProvider, loadLocale, preloadI18n } from "./i18n/runtime";
import { WindowCrashBoundary } from "./components/window-crash/WindowCrashBoundary";
import { closeWindow, crashOutcome, handleCrash, installCrashReporting, openCrashLog, reloadWindow, restartFuyu, retryWindow } from "./lib/crash-report/crashReporter";
import { summarizeError } from "./lib/crash-report/errorSummary";
import { CRASH_RELOAD_WINDOW_MS, crashVariant, type CrashOutcome } from "./lib/crash-report/recovery";
import { loadSettingsFile } from "./lib/settings-backup/loadSettingsFile";
import { serviceFeaturesForWindow } from "./windowServicesMap";
import { trackIslandTopEdge } from "./windows/island/topEdge";
import { trackIslandNotch } from "./windows/island/notch";
import { trackAutoIslandForm } from "./windows/island/autoIslandForm";
import { setPluginSettingsOpener } from "./features/plugin-kernel/settingsOpener";
import { openPluginSettingsWindow } from "./windows/settings/api";

blockBrowserDefaults({ mac: isMacOS, dev: import.meta.env.DEV });
installCrashReporting();
if (import.meta.hot) void import("./devCompileError");
const serviceModules = import.meta.glob("./features/*/plugin/services.ts");

async function loadWindowServices(kind: string | null): Promise<void> {
  const features = serviceFeaturesForWindow(kind);
  await Promise.all(
    features.map((feature) => {
      const load = serviceModules[`./features/${feature}/plugin/services.ts`];
      return load ? load() : Promise.resolve();
    }),
  );
}

const windowKind = new URLSearchParams(window.location.search).get("window");
setPluginSettingsOpener(openPluginSettingsWindow);

if (windowKind === null) {
  trackIslandTopEdge();
  trackIslandNotch();
  trackAutoIslandForm();
}

window.addEventListener(
  "pointerdown",
  () => {
    document.documentElement.dataset.inputModality = "pointer";
  },
  true,
);

window.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Tab") {
      document.documentElement.dataset.inputModality = "keyboard";
    }
  },
  true,
);

async function loadWindow(): Promise<ReactNode> {
  switch (windowKind) {
    case "translation": {
      const { TranslationWindow } = await import("./windows/translation/TranslationWindow");
      return <TranslationWindow />;
    }
    case "settings": {
      const { SettingsWindow } = await import("./windows/settings/SettingsWindow");
      return <SettingsWindow />;
    }
    case "clipboard": {
      const { ClipboardWindow } = await import("./windows/clipboard/ClipboardWindow");
      return <ClipboardWindow />;
    }
    case "clipboard-preview": {
      const { ClipboardPreviewWindow } = await import("./windows/clipboard/ClipboardPreviewWindow");
      return <ClipboardPreviewWindow />;
    }
    case "screenshot": {
      const { ScreenshotOverlay } = await import("./windows/screenshot/ScreenshotOverlay");
      return <ScreenshotOverlay />;
    }
    case "pin": {
      const { PinWindow } = await import("./windows/screenshot/PinWindow");
      return <PinWindow />;
    }
    case "tray-menu": {
      const { TrayMenuWindow } = await import("./windows/tray-menu/TrayMenuWindow");
      return <TrayMenuWindow />;
    }
    case "drag-grid": {
      const { DragGridWindow } = await import("./windows/drag-grid/DragGridWindow");
      return <DragGridWindow />;
    }
    case "onboarding": {
      const { OnboardingWindow } = await import("./windows/onboarding/OnboardingWindow");
      return <OnboardingWindow />;
    }
    case "plugin-window": {
      const { PluginWindowApp } = await import("./windows/plugin-window/PluginWindowApp");
      return <PluginWindowApp />;
    }
    default: {
      const [{ TodosGate }, { IslandApp }] = await Promise.all([
        import("./features/todos/TodosGate"),
        import("./windows/island/IslandApp"),
      ]);
      return (
        <TodosGate>
          <IslandApp />
        </TodosGate>
      );
    }
  }
}

const rootOptions: RootOptions = import.meta.hot
  ? devRootOptions
  : {
      onUncaughtError(error, info) {
        handleCrash("uncaught", error, info.componentStack);
      },
    };

function onWindowCrash(error: unknown, componentStack: string | null) {
  markCrashed();
  return crashOutcome("render", error, componentStack);
}

const crashActions = { reload: retryWindow, autoReload: reloadWindow, restart: restartFuyu, openLog: openCrashLog, close: closeWindow };

function renderWindow(content: ReactNode, failure?: CrashOutcome & { message: string }) {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement, rootOptions).render(
    <React.StrictMode>
      <I18nProvider>
        <WindowCrashBoundary
          variant={crashVariant(windowKind)}
          initial={failure}
          dev={Boolean(import.meta.hot)}
          retryAfterMs={CRASH_RELOAD_WINDOW_MS}
          onCrash={onWindowCrash}
          actions={crashActions}
        >
          {content}
        </WindowCrashBoundary>
      </I18nProvider>
    </React.StrictMode>,
  );
}

void Promise.all([
  loadWindowServices(windowKind),
  loadWindow(),
  loadSettingsFile(),
  preloadI18n(loadLocale(), windowKind),
]).then(([, content]) => {
  renderWindow(content);
  markMounted();
}).catch(async (error: unknown) => {
  console.error("Failed to start the window", error);
  const outcome = crashOutcome("startup", error);
  if (outcome.step !== "fallback") return;
  await preloadI18n(loadLocale(), windowKind);
  renderWindow(null, { ...outcome, message: summarizeError(error).message });
}).catch((error: unknown) => console.error("Failed to show the startup failure", error));
