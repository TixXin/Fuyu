import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { SESSION_RING_STYLES, type SessionRingStyle } from "./ringConfig.ts";
import { useRingConfig } from "./useRingConfig";
import "./RingSettingsGroup.css";

function RingStyleArt({ style }: { style: SessionRingStyle }) {
  if (style === "ring") {
    return (
      <span className="session-ring-art">
        <span className="session-ring-art__ring">
          <span className="session-ring-art__ring-inner">6</span>
        </span>
      </span>
    );
  }

  if (style === "bar") {
    return (
      <span className="session-ring-art">
        <span className="session-ring-art__bar-wrap">
          <strong className="session-ring-art__count">6</strong>
          <span className="session-ring-art__bar">
            <i className="session-ring-art__seg session-ring-art__seg--needs" />
            <i className="session-ring-art__seg session-ring-art__seg--turn" />
            <i className="session-ring-art__seg session-ring-art__seg--work" />
            <i className="session-ring-art__seg session-ring-art__seg--done" />
          </span>
        </span>
      </span>
    );
  }

  if (style === "signal") {
    return (
      <span className="session-ring-art">
        <span className="session-ring-art__signal">
          <span className="session-ring-art__col">
            <i /><i /><i className="session-ring-art__lit--done" /><i className="session-ring-art__lit--done" />
          </span>
          <span className="session-ring-art__col">
            <i /><i className="session-ring-art__lit--work" /><i className="session-ring-art__lit--work" /><i className="session-ring-art__lit--work" />
          </span>
          <span className="session-ring-art__col">
            <i /><i /><i /><i className="session-ring-art__lit--turn" />
          </span>
          <span className="session-ring-art__col">
            <i /><i /><i /><i className="session-ring-art__lit--needs" />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="session-ring-art">
      <span className="session-ring-art__grid">
        <i className="session-ring-art__lit--needs" />
        <i className="session-ring-art__lit--turn" />
        <i className="session-ring-art__lit--work" />
        <i className="session-ring-art__lit--work" />
        <i className="session-ring-art__lit--done" />
        <i className="session-ring-art__lit--done" />
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

export function RingSettingsGroup() {
  const text = useTranslation().sessionRing.settings;
  const [config, update] = useRingConfig();
  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.footer} />}>
      <SettingsRow title={text.style}>
        <SettingsChoiceCards<SessionRingStyle>
          value={config.style}
          ariaLabel={text.style}
          options={SESSION_RING_STYLES.map((style) => ({
            value: style,
            label: text.styles[style],
            hint: text.styleHints[style],
            art: <RingStyleArt style={style} />,
          }))}
          onChange={(style) => update("style", style)}
        />
      </SettingsRow>
      <SettingsToggleRow title={text.showCount} description={text.showCountHint} checked={config.showCount} onChange={(on) => update("showCount", on)} />
    </SettingsGroup>
  );
}
