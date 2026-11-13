import type { ReactNode } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { ClipboardHistorySettings, ClipboardOpenIn, ClipboardPopupLayout, ClipboardPopupPosition } from "./api";

export function ClipboardSettingsSection({ clipboardSettings, onClipboardSettingsChange, shortcuts, children }: {
  clipboardSettings: ClipboardHistorySettings;
  onClipboardSettingsChange: (settings: ClipboardHistorySettings) => void;
  shortcuts?: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslation();
  const text = t.settings.clipboard;
  const change = (patch: Partial<ClipboardHistorySettings>) => onClipboardSettingsChange({ ...clipboardSettings, ...patch });
  const inWindow = clipboardSettings.openIn === "window";

  return (
    <>
      <SettingsGroup title={text.openTitle}>
        <SettingsRow
          title={text.openIn}
          description={text.openInHint}
          control={
            <SettingsChoice<ClipboardOpenIn>
              value={clipboardSettings.openIn}
              ariaLabel={text.openIn}
              options={[
                { value: "window", label: text.openInOptions.window },
                { value: "island", label: text.openInOptions.island },
              ]}
              onChange={(openIn) => change({ openIn })}
            />
          }
        />
        {inWindow && (
          <SettingsRow
            indent
            title={text.popupPosition}
            control={
              <SettingsChoice<ClipboardPopupPosition>
                value={clipboardSettings.popupPosition}
                ariaLabel={text.popupPosition}
                options={[
                  { value: "cursor", label: text.popupPositionOptions.cursor },
                  { value: "center", label: text.popupPositionOptions.center },
                ]}
                onChange={(popupPosition) => change({ popupPosition })}
              />
            }
          />
        )}
        {inWindow && (
          <SettingsRow
            indent
            title={text.popupLayout}
            description={text.popupLayoutHint}
            control={
              <SettingsChoice<ClipboardPopupLayout>
                value={clipboardSettings.popupLayout ?? "standard"}
                ariaLabel={text.popupLayout}
                options={[
                  { value: "standard", label: text.popupLayoutOptions.standard },
                  { value: "wide", label: text.popupLayoutOptions.wide },
                ]}
                onChange={(popupLayout) => change({ popupLayout })}
              />
            }
          />
        )}
        {inWindow && (
          <SettingsToggleRow
            indent
            title={text.autoPaste}
            description={isMacOS ? text.autoPasteHintMac : text.autoPasteHint}
            checked={clipboardSettings.autoPaste}
            onChange={(autoPaste) => change({ autoPaste })}
          />
        )}
        {inWindow && clipboardSettings.autoPaste && (
          <SettingsToggleRow
            indent
            title={text.terminalImagePath}
            description={isMacOS ? text.terminalImagePathHintMac : text.terminalImagePathHint}
            checked={clipboardSettings.terminalImagePath}
            onChange={(terminalImagePath) => change({ terminalImagePath })}
          />
        )}
        {inWindow && clipboardSettings.autoPaste && (
          <SettingsToggleRow
            indent
            title={text.flattenTerminalCommands}
            description={text.flattenTerminalCommandsHint}
            checked={clipboardSettings.flattenTerminalCommands === true}
            onChange={(flattenTerminalCommands) => change({ flattenTerminalCommands })}
          />
        )}
        {inWindow && (
          <SettingsToggleRow
            indent
            title={text.hideFromCapture}
            description={text.hideFromCaptureHint}
            checked={clipboardSettings.hideFromCapture !== false}
            onChange={(hideFromCapture) => change({ hideFromCapture })}
          />
        )}
        {inWindow && (
          <SettingsToggleRow
            indent
            title={text.linkPreview}
            description={text.linkPreviewHint}
            checked={clipboardSettings.linkPreview === true}
            onChange={(linkPreview) => change({ linkPreview })}
          />
        )}
        {children}
      </SettingsGroup>
      {shortcuts}
    </>
  );
}
