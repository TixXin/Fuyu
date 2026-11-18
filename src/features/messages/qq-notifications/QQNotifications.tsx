import type { ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import { ImNotificationControls, ImNotificationPanel, imPanelCopyFor } from "../im-sources/ImNotificationPanel";
import type { QQNotificationsController } from "./useQQNotifications";

export { useQQNotifications } from "./useQQNotifications";
export type { QQNotificationsController };

export function QQNotificationControls({ controller, compact = false }: { controller: QQNotificationsController; compact?: boolean }) {
  const t = useTranslation();
  return <ImNotificationControls controller={controller} copy={imPanelCopyFor("qq", t)} compact={compact} />;
}

export function QQNotificationPanel({ controller, navigation }: { controller: QQNotificationsController; navigation: ReactNode }) {
  const t = useTranslation();
  return (
    <ImNotificationPanel
      source="qq"
      controller={{ ...controller, openApp: controller.openQQ }}
      copy={imPanelCopyFor("qq", t)}
      navigation={navigation}
    />
  );
}
