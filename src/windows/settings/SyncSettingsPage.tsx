import { useState } from "react";
import { SyncBackendSection } from "../../features/sync/SyncBackendSection";
import { SyncCategoriesSection } from "../../features/sync/SyncCategoriesSection";
import { SyncDevicesSection } from "../../features/sync/SyncDevicesSection";
import { SyncEncryptionSection } from "../../features/sync/SyncEncryptionSection";
import { SyncHelpSection } from "../../features/sync/SyncHelpSection";
import { SyncOptionalSection } from "../../features/sync/SyncOptionalSection";
import { SyncSetupGuide } from "../../features/sync/SyncSetupGuide";
import { SyncStatusSection } from "../../features/sync/SyncStatusSection";
import { SYNC_SECURITY_SECTIONS } from "../../features/sync/syncBackends";
import { isSyncActive } from "../../features/sync/syncState";
import { useSyncSettings } from "../../features/sync/useSyncSettings";
import "../../features/sync/SyncSettings.css";

export function SyncSettingsPage() {
  const sync = useSyncSettings();
  const [wantEncryption, setWantEncryption] = useState(false);
  const [managing, setManaging] = useState(false);
  const active = isSyncActive(sync.status);

  if (!active && managing) setManaging(false);
  if (!sync.loaded) return null;

  if (!active) {
    return (
      <>
        <SyncSetupGuide
          status={sync.status}
          busy={sync.busy}
          actionError={sync.actionError}
          wantEncryption={wantEncryption}
          onWantEncryption={setWantEncryption}
          onChooseFolder={(title) => void sync.chooseFolder(title)}
          onSaveWebdav={(url, username, password) => sync.saveWebdav(url, username, password)}
          onStopSync={(forgetWebdav) => void sync.stopCurrentSync(forgetWebdav)}
        />
        <SyncHelpSection />
      </>
    );
  }

  return (
    <>
      <SyncStatusSection
        status={sync.status}
        busy={sync.busy}
        actionError={sync.actionError}
        managing={managing}
        onSyncNow={() => void sync.runSyncNow()}
        onConfirmDeletions={() => void sync.confirmDeletions()}
        onStopSync={() => void sync.stopCurrentSync(false)}
        onManage={() => setManaging((open) => !open)}
      />
      {managing ? (
        <SyncBackendSection
          status={sync.status}
          busy={sync.busy}
          onChooseFolder={(title) => void sync.chooseFolder(title)}
          onRevealFolder={() => void sync.revealFolder()}
          onSaveWebdav={(url, username, password) => sync.saveWebdav(url, username, password)}
          onStopSync={(forgetWebdav) => void sync.stopCurrentSync(forgetWebdav)}
        />
      ) : null}
      <SyncCategoriesSection
        status={sync.status}
        busy={sync.busy}
        onToggle={(category, checked) => void sync.toggleCategory(category, checked)}
      />
      {SYNC_SECURITY_SECTIONS.map((entry) =>
        entry.id === "encryption" ? (
          <SyncEncryptionSection key={entry.id} status={sync.status} busy={sync.busy} startOpen={wantEncryption} />
        ) : entry.component ? (
          <entry.component key={entry.id} status={sync.status} busy={sync.busy} />
        ) : null,
      )}
      <SyncOptionalSection
        enabledGroups={sync.status.optionalGroups}
        busy={sync.busy}
        onToggle={(group, checked) => void sync.toggleOptionalGroup(group, checked)}
      />
      <SyncDevicesSection devices={sync.status.devices} />
      <SyncHelpSection />
    </>
  );
}
