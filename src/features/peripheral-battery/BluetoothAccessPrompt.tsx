import { Bluetooth } from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "../../i18n";
import { useBluetoothAccess } from "./useBluetoothAccess";

export function BluetoothAccessPrompt() {
  const t = useTranslation().islandWidgets.content;
  const { access, asking, request, openSettings } = useBluetoothAccess();
  if (access !== "notDetermined" && access !== "denied") return null;
  const denied = access === "denied";
  const onClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (denied) openSettings();
    else request();
  };
  return (
    <div className="peripheral-battery__access">
      {denied ? <p className="peripheral-battery__access-hint">{t.bluetoothAccessDenied}</p> : null}
      <button className="peripheral-battery__access-button" type="button" disabled={asking} title={denied ? t.bluetoothOpenSettings : t.bluetoothAccessHint} onClick={onClick}>
        <Bluetooth size={11} strokeWidth={2.2} aria-hidden="true" />
        <span>{denied ? t.bluetoothOpenSettings : t.bluetoothAccessAsk}</span>
      </button>
    </div>
  );
}
