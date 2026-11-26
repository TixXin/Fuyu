import "./lib/copyRenamedKeys";
import { devRootOptions, markCrashed, markMounted } from "./devReload";
import { blockBrowserDefaults } from "./lib/browserDefaults";
import { isMacOS } from "./lib/platform";
import React, { type ReactNode } from "react";
import ReactDOM, { type RootOptions } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/base.css";
import { I18nProvider, loadLocale, preloadI18n, preloadScreenshotI18n } from "./i18n/runtime";
import { WindowCrashBoundary } from "./components/window-crash/WindowCrashBoundary";
import { closeWindow, crashOutcome, handleCrash, installCrashReporting, openCrashLog, reloadWindow, restartFuyu, retryWindow } from "./lib/crash-report/crashReporter";
import { summarizeError } from "./lib/crash-report/errorSummary";
import { CRASH_RELOAD_WINDOW_MS, crashVariant, type CrashOutcome } from "./lib/crash-report/recovery";
import { setPluginSettingsOpener } from "./features/plugin-kernel/settingsOpener";
import { prefetchScreenshot } from "./features/screenshot/frame/api";

blockBrowserDefaults({ mac: isMacOS, dev: import.meta.env.DEV });
installCrashReporting();
if (import.meta.hot) void import("./devCompileError");

async function loadWindowServices(kind: string | null): Promise<void> {
  const { loadWindowServicesFor } = await import("./windowServicesLoader");
  await loadWindowServicesFor(kind);
}

async function installFont(): Promise<void> {
  const { installWindowFont } = await import("./lib/theme/windowFont");
  installWindowFont();
}

async function syncSettingsFile(): Promise<void> {
  const { loadSettingsFile } = await import("./lib/settings-backup/loadSettingsFile");
  await loadSettingsFile();
}

const windowKind = new URLSearchParams(window.location.search).get("window");
if (windowKind === "screenshot") prefetchScreenshot();
setPluginSettingsOpener((plugin) =>
  import("./windows/settings/api").then((module) => module.openPluginSettingsWindow(plugin)),
);

if (windowKind === null) {
  void import("./windows/island/topEdge").then((module) => module.trackIslandTopEdge());
  void import("./windows/island/notch").then((module) => module.trackIslandNotch());
  void import("./windows/island/autoIslandForm").then((module) => module.trackAutoIslandForm());
  if (import.meta.env.DEV) void import("./windows/island/devFrameProbe");
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
    case "taskbar-lyrics": {
      const { TaskbarLyricsWindow } = await import("./windows/taskbar-lyrics/TaskbarLyricsWindow");
      return <TaskbarLyricsWindow />;
    }
    case "side": {
      const [{ TodosGate }, { SideDockWindow }] = await Promise.all([
        import("./features/todos/TodosGate"),
        import("./windows/side-dock/SideDockWindow"),
      ]);
      return (
        <TodosGate>
          <SideDockWindow />
        </TodosGate>
      );
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

const startup =
  windowKind === "screenshot"
    ? Promise.all([loadWindow(), preloadScreenshotI18n(loadLocale())]).then(([content]) => ({ content, applyFont: null as (() => void) | null }))
    : Promise.all([
        loadWindowServices(windowKind),
        loadWindow(),
        syncSettingsFile(),
        preloadI18n(loadLocale(), windowKind),
        import("./lib/theme/windowFont"),
      ]).then(([, content, , , fontModule]) => ({ content, applyFont: fontModule.installWindowFont }));

void startup.then(({ content, applyFont }) => {
  applyFont?.();
  renderWindow(content);
  markMounted();
  if (windowKind === "screenshot") {
    window.setTimeout(() => {
      void preloadI18n(loadLocale(), windowKind);
      void installFont();
      void loadWindowServices(windowKind);
      void syncSettingsFile();
    }, 250);
  }
}).catch(async (error: unknown) => {
  console.error("Failed to start the window", error);
  const outcome = crashOutcome("startup", error);
  if (outcome.step !== "fallback") return;
  await preloadI18n(loadLocale(), windowKind);
  renderWindow(null, { ...outcome, message: summarizeError(error).message });
}).catch((error: unknown) => console.error("Failed to show the startup failure", error));
