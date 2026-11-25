import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../i18n";
import { CapsLockIcon, NumLockIcon } from "./CapsLockIcon";
import { capsLockState } from "./plugin/islandState";
import "./CapsLock.css";

type FlagBox = { top: number; right: number };

const EDITABLE_SELECTOR = "input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='button']):not([type='submit']):not([type='reset']):not([type='file']):not([type='color']):not([type='hidden']), textarea, [contenteditable='true']";

function activePanelInput(panel: HTMLElement | null): HTMLElement | null {
  if (!panel) return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !panel.contains(active)) return null;
  return active.matches(EDITABLE_SELECTOR) ? active : active.closest<HTMLElement>(EDITABLE_SELECTOR);
}

function measureFlag(panel: HTMLElement, input: HTMLElement): FlagBox | null {
  const panelRect = panel.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  if (panelRect.width <= 0 || inputRect.width <= 0 || inputRect.height <= 0) return null;
  const zoom = panel.offsetWidth > 0 ? panelRect.width / panel.offsetWidth : 1;
  const scale = zoom > 0.01 ? zoom : 1;
  return {
    top: (inputRect.top + inputRect.height / 2 - panelRect.top) / scale,
    right: (panelRect.right - inputRect.right) / scale + 8,
  };
}

export function CapsLockOverlay() {
  const { expanded, on, alert } = capsLockState.use();
  const text = useTranslation().island.capsLock;
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [flagBox, setFlagBox] = useState<FlagBox | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (!expanded) {
      setPanel(null);
      setInputFocused(false);
      setFlagBox(null);
      return;
    }
    const element = document.getElementById("island-panel");
    setPanel(element);
    if (!element) return;
    const sync = () => {
      const input = activePanelInput(element);
      setInputFocused(input !== null);
      setFlagBox(input ? measureFlag(element, input) : null);
    };
    sync();
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    element.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
      element.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [expanded]);

  if (!expanded || !panel) return null;

  const showInputFlag = on && inputFocused && flagBox !== null;
  const showCapsule = alert !== null && !inputFocused;
  if (!showInputFlag && !showCapsule) return null;

  const Icon = alert?.key === "num" ? NumLockIcon : CapsLockIcon;
  const capsuleLabel = alert
    ? alert.password
      ? text.password
      : alert.key === "num"
        ? alert.on
          ? text.numOn
          : text.numOff
        : alert.on
          ? text.on
          : text.off
    : "";

  return createPortal(
    <>
      {showCapsule && alert && (
        <span
          className={`caps-lock-capsule caps-lock-alert--${alert.on ? "on" : "off"}`}
          role="status"
          aria-label={capsuleLabel}
          data-caps-lock-capsule
        >
          <Icon on={alert.on} size={14} className="caps-lock-alert__icon" />
          <span aria-hidden="true">{capsuleLabel}</span>
        </span>
      )}
      {showInputFlag && flagBox && (
        <span
          className="caps-lock-input-flag"
          style={{ top: `${flagBox.top}px`, right: `${flagBox.right}px` }}
          aria-hidden="true"
          data-caps-lock-input-flag
        >
          <CapsLockIcon on size={13} />
        </span>
      )}
    </>,
    panel,
  );
}
