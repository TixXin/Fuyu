import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandAlertMeta, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { CapsLockBadge } from "../CapsLockBadge";
import { CapsLockIcon } from "../CapsLockIcon";
import { CapsLockPopup } from "../CapsLockPopup";
import { CAPS_LOCK_BADGE_HINT, CAPS_LOCK_BADGE_WIDTH, CAPS_LOCK_ITEM, capsLockState } from "./islandState";
import { OWNER } from "./owner.ts";

const alertSlot = defineSlot<object, IslandAlertMeta<object>>("island.alert/v1");
type GaugeContext = { hints: ReadonlySet<string> };

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

function tone(on: boolean) {
  return `caps-lock-alert caps-lock-alert--${on ? "on" : "off"}`;
}

function CapsLockAlertLeading() {
  const { alert } = capsLockState.use();
  if (!alert) return null;
  return (
    <span className={`notch-alert__icon ${tone(alert.on)}`} aria-hidden="true">
      <CapsLockIcon on={alert.on} className="caps-lock-alert__icon" />
    </span>
  );
}

function CapsLockAlertTrailing() {
  const text = useTranslation().island.capsLock;
  const { alert } = capsLockState.use();
  if (!alert) return null;
  return (
    <span className={`notch-alert__value ${tone(alert.on)}`} role="status" aria-label={alert.on ? text.on : text.off}>
      <span className="caps-lock-alert__short" aria-hidden="true">{alert.on ? text.short : text.shortOff}</span>
    </span>
  );
}

function CapsLockAlertBody() {
  const { alert } = capsLockState.use();
  return alert ? <CapsLockPopup on={alert.on} /> : null;
}

function CapsLockItem() {
  const { badgeClick } = capsLockState.use();
  return <CapsLockBadge clickable={badgeClick} />;
}

alertSlot.add({ id: "caps-lock", order: 5, component: CapsLockAlertLeading, trailing: CapsLockAlertTrailing, popup: CapsLockAlertBody }, OWNER);
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
