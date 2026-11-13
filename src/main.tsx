import "./lib/copyRenamedKeys";
import React, { type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/base.css";
import { I18nProvider } from "./i18n";
import { loadSettingsFile } from "./features/settings-backup/loadSettingsFile";
import { trackIslandTopEdge } from "./windows/island/topEdge";
import { trackIslandNotch } from "./windows/island/notch";

const windowKind = new URLSearchParams(window.location.search).get("window");

if (windowKind === null) {
  trackIslandTopEdge();
  trackIslandNotch();
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
    case "screenshot": {
      const { ScreenshotOverlay } = await import("./windows/screenshot/ScreenshotOverlay");
      return <ScreenshotOverlay />;
    }
    case "pin": {
      const { PinWindow } = await import("./windows/screenshot/PinWindow");
      return <PinWindow />;
    }
    case "onboarding": {
      const { OnboardingWindow } = await import("./windows/onboarding/OnboardingWindow");
      return <OnboardingWindow />;
    }
    default: {
      const [{ TodosGate }, { IslandApp }] = await Promise.all([
        import("./windows/island/TodosGate"),
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

void Promise.all([loadWindow(), loadSettingsFile()]).then(([content]) => ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>{content}</I18nProvider>
  </React.StrictMode>,
)).catch((error: unknown) => console.error("Failed to start the window", error));
