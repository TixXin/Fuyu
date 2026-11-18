import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import {
  RECORD_FORMATS,
  RECORD_FPS,
  RECORD_QUALITIES,
  type RecordFormat,
  type RecordFps,
  type RecordQuality,
  type RecordSettings,
  type ScreenshotSettings,
} from "./settings";
import { useTranslation } from "../../i18n";

export function RecordSettingsGroup({ screenshot, onChange }: { screenshot: ScreenshotSettings; onChange: (settings: ScreenshotSettings) => void }) {
  const text = useTranslation().settings.screenshot;
  const record = screenshot.record;
  const set = (patch: Partial<RecordSettings>) => onChange({ ...screenshot, record: { ...record, ...patch } });
  return (
    <SettingsGroup title={text.recordTitle}>
      <SettingsRow
        title={text.recordFormat}
        description={text.recordFormatHint}
        control={
          <SettingsChoice<RecordFormat>
            value={record.format}
            options={RECORD_FORMATS.map((format) => ({ value: format, label: text.recordFormats[format] }))}
            ariaLabel={text.recordFormat}
            onChange={(format) => set({ format })}
          />
        }
      />
      <SettingsRow
        title={text.recordFps}
        description={text.recordFpsHint}
        control={
          <SettingsChoice
            value={String(record.fps)}
            options={RECORD_FPS.map((fps) => ({ value: String(fps), label: text.recordFpsOption(fps) }))}
            ariaLabel={text.recordFps}
            onChange={(fps) => set({ fps: Number(fps) as RecordFps })}
          />
        }
      />
      <SettingsRow
        title={text.recordQuality}
        description={text.recordQualityHint}
        control={
          <SettingsChoice<RecordQuality>
            value={record.quality}
            options={RECORD_QUALITIES.map((quality) => ({ value: quality, label: text.recordQualities[quality] }))}
            ariaLabel={text.recordQuality}
            onChange={(quality) => set({ quality })}
          />
        }
      />
      <SettingsToggleRow
        title={text.recordSystemAudio}
        description={text.recordSystemAudioHint}
        checked={record.systemAudio}
        onChange={(systemAudio) => set({ systemAudio })}
      />
      <SettingsToggleRow
        title={text.recordMicrophone}
        description={text.recordMicrophoneHint}
        checked={record.microphone}
        onChange={(microphone) => set({ microphone })}
      />
      <SettingsToggleRow
        title={text.recordOwnWindows}
        description={text.recordOwnWindowsHint}
        checked={record.ownWindows}
        onChange={(ownWindows) => set({ ownWindows })}
      />
    </SettingsGroup>
  );
}
