import { useTranslation } from "../../i18n";
import { CapsLockIcon, NumLockIcon } from "./CapsLockIcon";
import "./CapsLock.css";

export function CapsLockPopup({ on, keyKind = "caps", password = false }: { on: boolean; keyKind?: "caps" | "num"; password?: boolean }) {
  const text = useTranslation().island.capsLock;
  const label = password ? text.password : keyKind === "num" ? (on ? text.numOn : text.numOff) : on ? text.on : text.off;
  const Icon = keyKind === "num" ? NumLockIcon : CapsLockIcon;
  return (
    <span className={`caps-lock-alert caps-lock-alert--${on ? "on" : "off"}${password ? " caps-lock-alert--warn" : ""}`} role="status" aria-label={label}>
      <Icon on={on} className="caps-lock-alert__icon" />
      <span className="caps-lock-alert__text" aria-hidden="true">{label}</span>
    </span>
  );
}
