import { useTranslation } from "../../i18n";
import { turnOffCapsLock } from "./api";
import { CapsLockIcon } from "./CapsLockIcon";
import "./CapsLock.css";

export function CapsLockBadge({ clickable }: { clickable: boolean }) {
  const text = useTranslation().island.capsLock;
  const label = clickable ? text.badgeClick : text.badge;
  if (!clickable) {
    return (
      <span className="caps-lock-badge" role="img" aria-label={label} title={label}>
        <CapsLockIcon on size={13} />
      </span>
    );
  }
  return (
    <button
      className="caps-lock-badge caps-lock-badge--clickable"
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        void turnOffCapsLock().catch((error: unknown) => console.error("Failed to turn off Caps Lock", error));
      }}
    >
      <CapsLockIcon on size={13} />
    </button>
  );
}
