import { Laptop } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useLocale, useTranslation } from "../../i18n";
import type { SyncDevice } from "./api";
import { isDeviceStale } from "./syncState";

function platformLabel(
  platform: string,
  labels: ReturnType<typeof useTranslation>["sync"]["devices"]["platforms"],
): string {
  if (platform === "windows") return labels.windows;
  if (platform === "macos") return labels.macos;
  if (platform === "linux") return labels.linux;
  return platform;
}

export function SyncDevicesSection({ devices }: { devices: readonly SyncDevice[] }) {
  const text = useTranslation().sync.devices;
  const { locale } = useLocale();
  const now = Date.now();

  return (
    <SettingsGroup title={text.groupTitle}>
      {devices.length === 0 ? (
        <SettingsRow
          searchable={false}
          title={text.empty}
          description={text.emptyHint}
        />
      ) : (
        devices.map((device) => {
          const time = device.lastSyncAt > 0
            ? new Date(device.lastSyncAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
            : "—";
          const stale = !device.thisDevice && isDeviceStale(device.lastSyncAt, now);

          return (
            <SettingsRow
              key={device.deviceId}
              searchable={false}
              title={
                <span className="sync-device__title">
                  <Laptop size={15} strokeWidth={1.8} aria-hidden="true" />
                  <span>{device.name || device.deviceId.slice(0, 8)}</span>
                  {device.thisDevice ? (
                    <span className="sync-badge sync-badge--ok">{text.thisDevice}</span>
                  ) : null}
                  {stale ? (
                    <span className="sync-badge sync-badge--warn">{text.stale}</span>
                  ) : null}
                </span>
              }
              description={text.meta(
                platformLabel(device.platform, text.platforms),
                device.appVersion,
                time,
              )}
            />
          );
        })
      )}
    </SettingsGroup>
  );
}
