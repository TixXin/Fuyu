import { useLayoutEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { PAGE_SWITCH_EFFECTS, PAGE_SWITCH_INDICATORS, PAGE_SWITCH_SPEEDS, nextCarouselTurn, pageSwitchSpeed, resolvePageSwitch, type SwitchAxis } from "../../../lib/theme/pageSwitch";
import { playPageSwitch, type PageSwitchHandle } from "../../../lib/theme/playPageSwitch";
import type { IslandSettings, PageSwitchEffect, PageSwitchSpeed } from "../../../lib/settings/types";
import "./PageSwitchGroup.css";

function PageSwitchThumb({ effect, speed, axis, turn }: { effect: PageSwitchEffect; speed: PageSwitchSpeed; axis: SwitchAxis; turn: number }) {
  const stage = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const shown = useRef(turn);
  const running = useRef<PageSwitchHandle | null>(null);
  useLayoutEffect(() => {
    if (shown.current === turn || !stage.current || !page.current) return;
    shown.current = turn;
    running.current?.finish();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kind = resolvePageSwitch(effect, effect === "carousel" ? nextCarouselTurn() : 0, reduced);
    running.current = playPageSwitch({ stage: stage.current, targets: [page.current], effect: kind, direction: 1, axis, origin: null, speed: pageSwitchSpeed(speed) });
  }, [axis, effect, speed, turn]);
  useLayoutEffect(() => () => running.current?.finish(), []);
  return (
    <div className="page-switch-thumb" ref={stage} aria-hidden="true">
      <div className="page-switch-thumb__page" ref={page} key={turn} data-variant={turn % 3}>
        <span /><span /><span />
      </div>
    </div>
  );
}

function EffectRow({ title, description, value, speed, axis, onChange }: {
  title: string;
  description: string;
  value: PageSwitchEffect;
  speed: PageSwitchSpeed;
  axis: SwitchAxis;
  onChange: (value: PageSwitchEffect) => void;
}) {
  const text = useTranslation().settings.expand;
  const [turn, setTurn] = useState(0);
  const play = () => setTurn((current) => current + 1);
  return (
    <SettingsRow
      title={title}
      description={description}
      control={
        <div className="page-switch-row">
          <PageSwitchThumb effect={value} speed={speed} axis={axis} turn={turn} />
          <SettingsSelect<PageSwitchEffect>
            value={value}
            options={PAGE_SWITCH_EFFECTS.map((effect) => ({ value: effect, label: text.switchEffects[effect] }))}
            ariaLabel={title}
            onChange={(next) => {
              onChange(next);
              play();
            }}
          />
          <button type="button" className="page-switch-row__try" aria-label={text.switchTry} title={text.switchTry} onClick={play}>
            <Play size={14} />
          </button>
        </div>
      }
    />
  );
}

export function PageSwitchGroup({ settings, update }: { settings: IslandSettings; update: (patch: Partial<IslandSettings>) => void }) {
  const text = useTranslation().settings.expand;
  return (
    <SettingsGroup title={text.switchTitle}>
      <EffectRow title={text.switchPanel} description={text.switchPanelHint} value={settings.pageSwitchPanel} speed={settings.pageSwitchSpeed} axis="x" onChange={(pageSwitchPanel) => update({ pageSwitchPanel })} />
      <EffectRow title={text.switchSettings} description={text.switchSettingsHint} value={settings.pageSwitchSettings} speed={settings.pageSwitchSpeed} axis="y" onChange={(pageSwitchSettings) => update({ pageSwitchSettings })} />
      <SettingsRow
        title={text.switchIndicator}
        description={text.switchIndicatorHint}
        control={<SettingsChoice value={settings.pageSwitchIndicator} options={PAGE_SWITCH_INDICATORS.map((value) => ({ value, label: text.switchIndicators[value] }))} ariaLabel={text.switchIndicator} onChange={(pageSwitchIndicator) => update({ pageSwitchIndicator })} />}
      />
      <SettingsRow
        title={text.switchSpeed}
        control={<SettingsChoice value={settings.pageSwitchSpeed} options={PAGE_SWITCH_SPEEDS.map((value) => ({ value, label: text.switchSpeeds[value] }))} ariaLabel={text.switchSpeed} onChange={(pageSwitchSpeed) => update({ pageSwitchSpeed })} />}
      />
      <SettingsToggleRow title={text.switchDirectional} description={text.switchDirectionalHint} checked={settings.pageSwitchDirectional} onChange={(pageSwitchDirectional) => update({ pageSwitchDirectional })} />
    </SettingsGroup>
  );
}
