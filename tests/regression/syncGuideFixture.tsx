import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import type { SyncStatus } from "../../src/features/sync/api";
import { SyncSetupGuide } from "../../src/features/sync/SyncSetupGuide";

export function renderGuideFixture(host: HTMLElement, status: SyncStatus) {
  createRoot(host).render(
    <StrictMode>
      <I18nProvider>
        <SyncSetupGuide
          status={{ ...status, phase: "off", backend: "off", folder: null, webdav: null, devices: [], lastSyncAt: null, error: null }}
          busy={false}
          actionError={null}
          wantEncryption={false}
          onWantEncryption={() => {}}
          onChooseFolder={() => {}}
          onSaveWebdav={async () => false}
          onStopSync={() => {}}
        />
      </I18nProvider>
    </StrictMode>,
  );
}
