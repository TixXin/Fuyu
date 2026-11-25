import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandAlertMeta, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { CapsLockBadge } from "../CapsLockBadge";
import { CapsLockIcon, NumLockIcon } from "../CapsLockIcon";
import { CapsLockOverlay } from "../CapsLockOverlay";
import { CapsLockPopup } from "../CapsLockPopup";
import { CAPS_LOCK_BADGE_HINT, CAPS_LOCK_BADGE_WIDTH, CAPS_LOCK_ITEM, capsLockState } from "./islandState";
import { OWNER } from "./owner.ts";

const alertSlot = defineSlot<object, IslandAlertMeta<object>>("island.alert/v1");
const overlaySlot = defineSlot<object>("island.overlay/v1");
type GaugeContext = { hints: ReadonlySet<string> };

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

function tone(on: boolean) {
  return `caps-lock-alert caps-lock-alert--${on ? "on" : "off"}`;
}

function CapsLockAlertLeading() {
  const { alert } = capsLockState.use();
  if (!alert) return null;
  const Icon = alert.key === "num" ? NumLockIcon : CapsLockIcon;
  return (
    <span className={`notch-alert__icon ${tone(alert.on)}`} aria-hidden="true">
      <Icon on={alert.on} className="caps-lock-alert__icon" />
    </span>
  );
}

function CapsLockAlertTrailing() {
  const text = useTranslation().island.capsLock;
  const { alert } = capsLockState.use();
  if (!alert) return null;
  const label = alert.password ? text.password : alert.key === "num" ? (alert.on ? text.numOn : text.numOff) : alert.on ? text.on : text.off;
  const short = alert.password ? text.passwordShort : alert.key === "num" ? (alert.on ? text.numShort : text.numShortOff) : alert.on ? text.short : text.shortOff;
  return (
    <span className={`notch-alert__value ${tone(alert.on)}`} role="status" aria-label={label}>
      <span className="caps-lock-alert__short" aria-hidden="true">{short}</span>
    </span>
  );
}

function CapsLockAlertBody() {
  const { alert } = capsLockState.use();
  return alert ? <CapsLockPopup on={alert.on} keyKind={alert.key} password={alert.password} /> : null;
}

function CapsLockItem() {
  const { badgeClick } = capsLockState.use();
  return <CapsLockBadge clickable={badgeClick} />;
}

alertSlot.add({ id: "caps-lock", order: 5, component: CapsLockAlertLeading, trailing: CapsLockAlertTrailing, popup: CapsLockAlertBody }, OWNER);
overlaySlot.add({ id: "caps-lock.overlay", order: 60, component: CapsLockOverlay }, OWNER);
gaugeSlot.add({
  id: CAPS_LOCK_ITEM,
  order: 76,
  group: "gauges",
  width: CAPS_LOCK_BADGE_WIDTH,
  hideable: true,
  label: (t) => t.island.capsLock.name,
  shown: ({ hints }) => hints.has(CAPS_LOCK_BADGE_HINT),
  component: CapsLockItem,
}, OWNER);
