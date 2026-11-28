import { ChevronDown, ChevronUp } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import { useTranslation } from "../../../i18n";
import { saveCollapsedText, textOrder, useCollapsedText, type NotchTextKind } from "../../../lib/settings/collapsedText";
import type { LyricsIslandPriority } from "../../../lib/settings/lyricsSettings";
import "./TextOrderRows.css";

export function TextOrderRows({ lyricsPriority, lyricsOff, disabled }: { lyricsPriority: LyricsIslandPriority; lyricsOff: boolean; disabled: boolean }) {
  const text = useTranslation().settings.layout;
  const { order: saved, hidden } = useCollapsedText();
  const order = textOrder(saved, lyricsPriority);
  const move = (at: number, by: number) => {
    const next = [...order];
    [next[at], next[at + by]] = [next[at + by], next[at]];
    saveCollapsedText({ order: next });
  };
  const show = (kind: NotchTextKind, on: boolean) => saveCollapsedText({ hidden: on ? hidden.filter((item) => item !== kind) : [...hidden, kind] });
  return (
    <SettingsGroup title={text.textOrderTitle} footer={text.textOrderHint}>
      {order.map((kind, at) => {
        const name = text.notchTextKinds[kind];
        return (
          <SettingsRow
            key={kind}
            title={name}
            description={kind === "lyrics" && lyricsOff ? text.lyricsNeedIsland : undefined}
            className="text-order__row"
            control={(
              <span className="text-order__controls" data-text-order={kind}>
                <button className="text-order__move" type="button" disabled={disabled || at === 0} aria-label={text.textOrderUp(name)} onClick={() => move(at, -1)}>
                  <ChevronUp size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button className="text-order__move" type="button" disabled={disabled || at === order.length - 1} aria-label={text.textOrderDown(name)} onClick={() => move(at, 1)}>
                  <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <SettingsSwitch id={`text-order-${kind}`} checked={!hidden.includes(kind)} disabled={disabled} ariaLabel={text.textOrderShow(name)} onChange={(on) => show(kind, on)} />
              </span>
            )}
          />
        );
      })}
    </SettingsGroup>
  );
}
