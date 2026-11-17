import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "../../i18n";
import { SettingsInlineConfirm } from "./SettingsInlineConfirm";
import { SettingsInput } from "./SettingsInput";
import { SettingsLinkButton } from "./SettingsLinkButton";
import { SettingsRow } from "./SettingsRow";
import "./SettingsSecretRow.css";

export function SettingsSecretRow({
  title,
  description,
  value,
  placeholder,
  ariaLabel,
  hasSecret,
  saving = false,
  testing = false,
  saveLabel,
  deleteLabel,
  deleteConfirmLabel,
  testLabel,
  searchable,
  onChange,
  onSave,
  onDelete,
  onTest,
}: {
  title: ReactNode;
  description?: ReactNode;
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  hasSecret: boolean;
  saving?: boolean;
  testing?: boolean;
  saveLabel: string;
  deleteLabel?: string;
  deleteConfirmLabel?: string;
  testLabel?: string;
  searchable?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  onTest?: () => void;
}) {
  const common = useTranslation().common;
  const [revealed, setRevealed] = useState(false);

  return (
    <SettingsRow
      title={title}
      description={description ?? (hasSecret ? common.saved : undefined)}
      searchable={searchable}
      control={
        <>
          <SettingsLinkButton disabled={!value.trim() || saving} onClick={onSave}>
            {saveLabel}
          </SettingsLinkButton>
          {onTest && (hasSecret || Boolean(value.trim())) ? (
            <SettingsLinkButton disabled={testing || saving} onClick={onTest}>
              {testLabel}
            </SettingsLinkButton>
          ) : null}
          {hasSecret && onDelete && deleteLabel ? (
            <SettingsInlineConfirm tone="danger" confirmLabel={deleteConfirmLabel} onConfirm={onDelete}>
              {deleteLabel}
            </SettingsInlineConfirm>
          ) : null}
        </>
      }
    >
      <div className="settings-secret-row__field">
        <SettingsInput
          type={revealed ? "text" : "password"}
          monospace
          autoComplete="off"
          aria-label={ariaLabel}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim() && !saving) onSave();
          }}
        />
        {value ? (
          <button
            type="button"
            className="settings-secret-row__eye"
            aria-label={revealed ? common.hideSecret : common.showSecret}
            onClick={() => setRevealed((current) => !current)}
          >
            {revealed ? <EyeOff size={14} strokeWidth={2} aria-hidden="true" /> : <Eye size={14} strokeWidth={2} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    </SettingsRow>
  );
}
