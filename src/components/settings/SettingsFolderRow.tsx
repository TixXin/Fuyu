import { type ReactNode, type Ref } from "react";
import { FolderOpen } from "lucide-react";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { pickFolder, revealFolder } from "../../lib/settings-backup/api";
import { SettingsInput } from "./SettingsInput";
import { SettingsLinkButton } from "./SettingsLinkButton";
import { SettingsRow } from "./SettingsRow";

export function SettingsFolderRow({
  title,
  description,
  value,
  placeholder,
  ariaLabel,
  readOnly = false,
  searchable,
  revealPath,
  revealLabel,
  browseTitle,
  browseLabel,
  resetLabel,
  onChange,
  onSubmit,
  onPick,
  onReset,
  extraControl,
  children,
  inputRef,
}: {
  title: ReactNode;
  description?: ReactNode;
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  readOnly?: boolean;
  searchable?: boolean;
  revealPath?: string | null;
  revealLabel?: string;
  browseTitle?: string;
  browseLabel?: string;
  resetLabel?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  onPick?: (picked: string) => void;
  onReset?: () => void;
  extraControl?: ReactNode;
  children?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const common = useTranslation().common;
  const openLabel = revealLabel ?? (isMacOS ? common.openFolderMac : common.openFolder);

  const choose = async () => {
    if (!onPick) return;
    const picked = await pickFolder(browseTitle);
    if (picked) onPick(picked);
  };

  return (
    <SettingsRow
      title={title}
      description={description}
      searchable={searchable}
      control={
        <>
          {revealPath ? (
            <SettingsLinkButton onClick={() => void revealFolder(revealPath)}>
              <FolderOpen size={13} strokeWidth={2.2} aria-hidden="true" />
              {openLabel}
            </SettingsLinkButton>
          ) : null}
          {!readOnly && onPick ? (
            <SettingsLinkButton onClick={() => void choose()}>{browseLabel ?? common.chooseFolder}</SettingsLinkButton>
          ) : null}
          {!readOnly && onReset && resetLabel ? <SettingsLinkButton onClick={onReset}>{resetLabel}</SettingsLinkButton> : null}
          {extraControl}
        </>
      }
    >
      <SettingsInput
        ref={inputRef}
        monospace
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={onChange ? (event) => onChange(event.currentTarget.value) : undefined}
        onKeyDown={
          onSubmit && !readOnly
            ? (event) => {
                if (event.key === "Enter") onSubmit();
              }
            : undefined
        }
      />
      {children}
    </SettingsRow>
  );
}
