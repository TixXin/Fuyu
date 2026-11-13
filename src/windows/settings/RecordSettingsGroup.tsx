import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
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
} from "../../features/screenshot/settings";
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
          <SettingsSelect
            value={record.format}
            options={RECORD_FORMATS.map((format) => ({ value: format, label: text.recordFormats[format] }))}
            ariaLabel={text.recordFormat}
            onChange={(format) => set({ format: format as RecordFormat })}
          />
        }
      />
      <SettingsRow
        title={text.recordFps}
        description={text.recordFpsHint}
        control={
          <SettingsSelect
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
          <SettingsSelect
            value={record.quality}
            options={RECORD_QUALITIES.map((quality) => ({ value: quality, label: text.recordQualities[quality] }))}
            ariaLabel={text.recordQuality}
            onChange={(quality) => set({ quality: quality as RecordQuality })}
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
    </SettingsGroup>
  );
}
