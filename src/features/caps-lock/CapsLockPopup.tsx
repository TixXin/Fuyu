import { useTranslation } from "../../i18n";
import { CapsLockIcon } from "./CapsLockIcon";
import "./CapsLock.css";

export function CapsLockPopup({ on }: { on: boolean }) {
  const text = useTranslation().island.capsLock;
  const label = on ? text.on : text.off;
  return (
    <span className={`caps-lock-alert caps-lock-alert--${on ? "on" : "off"}`} role="status" aria-label={label}>
      <CapsLockIcon on={on} className="caps-lock-alert__icon" />
      <span className="caps-lock-alert__text" aria-hidden="true">{label}</span>
    </span>
  );
}
