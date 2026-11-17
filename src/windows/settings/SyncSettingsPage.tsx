import { SyncBackendSection } from "../../features/sync/SyncBackendSection";
import { SyncCategoriesSection } from "../../features/sync/SyncCategoriesSection";
import { SyncDevicesSection } from "../../features/sync/SyncDevicesSection";
import { SyncHelpSection } from "../../features/sync/SyncHelpSection";
import { SyncOptionalSection } from "../../features/sync/SyncOptionalSection";
import { SyncStatusSection } from "../../features/sync/SyncStatusSection";
import { useSyncSettings } from "../../features/sync/useSyncSettings";
import "../../features/sync/SyncSettings.css";

export function SyncSettingsPage() {
  const sync = useSyncSettings();

  return (
    <>
      <SyncStatusSection
        status={sync.status}
        busy={sync.busy}
        actionError={sync.actionError}
        onSyncNow={() => void sync.runSyncNow()}
        onConfirmDeletions={() => void sync.confirmDeletions()}
        onStopSync={() => void sync.stopFolderSync()}
      />
      <SyncBackendSection
        status={sync.status}
        busy={sync.busy}
        onChooseFolder={(title) => void sync.chooseFolder(title)}
        onRevealFolder={() => void sync.revealFolder()}
        onStopSync={() => void sync.stopFolderSync()}
      />
      <SyncCategoriesSection
        status={sync.status}
        busy={sync.busy}
        onToggle={(category, checked) => void sync.toggleCategory(category, checked)}
      />
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
