import { useState } from "react";
import { Link2 } from "lucide-react";
import { SettingsAdvanced } from "../../../../components/settings/SettingsAdvanced";
import { SettingsChoice } from "../../../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../../components/settings/SettingsGroup";
import { SettingsMultiChoice } from "../../../../components/settings/SettingsMultiChoice";
import { SettingsRow } from "../../../../components/settings/SettingsRow";
import { useTranslation } from "../../../../i18n";
import { NOTCH_RIM_STYLES, notchRimLook } from "../../../../lib/settings/notchRimSettings";
import { DEFAULT_NOTCH_RING_SETTINGS, NOTCH_RING_STYLES, notchRingExtra, notchRingLook } from "../../../../lib/settings/notchRingSettings";
import {
  notchGap, notchLights, notchLinked, notchShared, notchStyles,
  withNotchGap, withNotchLights, withNotchLinked, withNotchShared, withNotchStyle,
  type NotchLights, type NotchState,
} from "../../../../lib/settings/notchSettingsModel";
import type { IslandSettings } from "../../../../lib/settings/types";
import { useAccentColor } from "../../../../lib/theme/useAccentColor";
import { usePageHidden } from "../../../../lib/usePageHidden";
import { ringLit } from "../../../island/notch-ring/ringPlan";
import { NotchFineRows } from "./NotchFineRows";
import type { MockGlow } from "./NotchMock";
import { NotchPreview } from "./NotchPreview";
import { NotchStyleStrip } from "./NotchStyleStrip";
import { NotchSwatches } from "./NotchSwatches";
import "./NotchSettings.css";

const DEFAULT_ACCENT = "var(--color-accent, #74d6ff)";
const TRIES = ["camera", "mic", "message", "agent", "music"] as const;
type Try = (typeof TRIES)[number];
const TRY_GLOWS: [Try, NonNullable<MockGlow>][] = [
  ["camera", { color: "#30d158", reason: "device-use.camera" }],
  ["mic", { color: "#ff9f0a", reason: "device-use.microphone" }],
  ["agent", { color: "#ff9f43", reason: "agent-status.waiting", pulse: true }],
  ["message", { color: "#12b7f5", reason: "messages.qq" }],
];
const TRY_SONG_MS = 30_000;
const LIGHTS = ["device", "status"] as const satisfies readonly (keyof NotchLights)[];

function firstState(settings: IslandSettings): NotchState {
  const collapsed = notchStyles(settings, "collapsed");
  return collapsed.rim === "off" && collapsed.ring === "off" ? "expanded" : "collapsed";
}

export function NotchSettings({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const text = useTranslation().settings.notch;
  const accent = useAccentColor(settings) ?? DEFAULT_ACCENT;
  const paused = usePageHidden();
  const [state, setState] = useState<NotchState>(() => firstState(settings));
  const [tries, setTries] = useState<readonly Try[]>([]);
  const [songAt, setSongAt] = useState(0);

  const linked = notchLinked(settings);
  const styles = notchStyles(settings, state);
  const shared = notchShared(settings);
  const lights = notchLights(settings);
  const glow = TRY_GLOWS.find(([key]) => tries.includes(key))?.[1] ?? null;
  const playback = tries.includes("music") ? { startedAt: songAt, durationMs: TRY_SONG_MS } : null;
  const rim = { island: notchRimLook(settings, "Island"), panel: notchRimLook(settings, "Panel"), accent, paused };
  const ring = { island: notchRingLook(settings, "Island"), panel: notchRingLook(settings, "Panel"), accent, paused };
  const extra = state === "collapsed" ? notchRingExtra(settings, ringLit(ring.island, glow)) : 0;
  const editing = linked ? text.editing.both : text.editing[state];
  const aurora = styles.rim === "aurora" || styles.ring === "aurora";
  const ringDefaults = notchRingLook(DEFAULT_NOTCH_RING_SETTINGS, "Island");

  const toggleTry = (value: Try, selected: boolean) => {
    if (value === "music" && selected) setSongAt(Date.now());
    setTries((current) => (selected ? [...current, value] : current.filter((item) => item !== value)));
  };

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      <div className="notch-settings__stage" data-search="off">
        <NotchPreview expanded={state === "expanded"} extra={extra} rim={rim} ring={ring} glow={glow} playback={playback} />
        <div className="notch-settings__bar">
          <div className="notch-settings__sides">
            <SettingsChoice
              value={state}
              options={(["collapsed", "expanded"] as const).map((value) => ({ value, label: text.states[value] }))}
              ariaLabel={text.stateLabel}
              onChange={setState}
            />
            <button
              type="button"
              className={linked ? "notch-settings__link notch-settings__link--on" : "notch-settings__link"}
              aria-pressed={linked}
              title={text.linkHint}
              onClick={() => onSettingsChange(withNotchLinked(settings, !linked, state))}
            >
              <Link2 size={14} aria-hidden="true" />
              {text.link}
            </button>
          </div>
          <div className="notch-settings__try" title={text.tryHint}>
            <span className="notch-settings__try-label">{text.tryLabel}</span>
            <SettingsMultiChoice
              values={tries}
              options={TRIES.map((value) => ({ value, label: text.tries[value] }))}
              ariaLabel={text.tryLabel}
              onToggle={toggleTry}
            />
          </div>
        </div>
      </div>
      <SettingsRow className="notch-settings__strip-row" title={text.rim} description={text.rimHint}>
        <NotchStyleStrip
          layer="rim"
          styles={NOTCH_RIM_STYLES}
          value={styles.rim}
          labels={text.rimStyles}
          hints={text.rimStyleHints}
          plain={text.plain}
          ariaLabel={text.rim}
          shared={shared}
          gap={notchGap(settings)}
          accent={accent}
          onChange={(style) => onSettingsChange(withNotchStyle(settings, "rim", state, style))}
        />
        <p className="notch-settings__caption">{editing}{text.rimStyleHints[styles.rim]}</p>
      </SettingsRow>
      <SettingsRow className="notch-settings__strip-row" title={text.ring} description={text.ringHint}>
        <NotchStyleStrip
          layer="ring"
          styles={NOTCH_RING_STYLES}
          value={styles.ring}
          labels={text.ringStyles}
          hints={text.ringStyleHints}
          plain={text.plain}
          ariaLabel={text.ring}
          shared={shared}
          gap={notchGap(settings)}
          accent={accent}
          onChange={(style) => onSettingsChange(withNotchStyle(settings, "ring", state, style))}
        />
        <p className="notch-settings__caption">{editing}{text.ringStyleHints[styles.ring]}</p>
      </SettingsRow>
      <SettingsRow
        title={text.color}
        description={aurora ? text.colorHintAurora : text.colorHint}
        control={(
          <NotchSwatches
            color={shared.color}
            customColor={shared.customColor}
            accent={accent}
            labels={text.colors}
            ariaLabel={text.color}
            onChange={(patch) => onSettingsChange(withNotchShared(settings, patch))}
          />
        )}
      />
      <SettingsRow
        title={text.lights}
        description={text.lightsHint}
        control={(
          <SettingsMultiChoice
            values={LIGHTS.filter((key) => lights[key])}
            options={LIGHTS.map((value) => ({ value, label: value === "device" ? text.lightDevice : text.lightStatus }))}
            ariaLabel={text.lights}
            onToggle={(key, selected) => onSettingsChange(withNotchLights(settings, { [key]: selected }))}
          />
        )}
      />
      <SettingsAdvanced label={text.fine}>
        <NotchFineRows
          text={text}
          shared={shared}
          gap={notchGap(settings)}
          bottom={settings.notchRingIslandBottom}
          defaults={{ intensity: ringDefaults.intensity, gap: ringDefaults.gap }}
          onShared={(patch) => onSettingsChange(withNotchShared(settings, patch))}
          onGap={(gap) => onSettingsChange(withNotchGap(settings, gap))}
          onBottom={(notchRingIslandBottom) => onSettingsChange({ ...settings, notchRingIslandBottom })}
        />
      </SettingsAdvanced>
    </SettingsGroup>
  );
}
