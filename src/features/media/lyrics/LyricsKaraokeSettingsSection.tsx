import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Music2 } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsColor } from "../../../components/settings/SettingsColor";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../appearance/types";
import { KaraokeText } from "./KaraokeText";
import { karaokeWords } from "./lrc";
import { karaokeLook, LYRICS_KARAOKE_DIM, type LyricsKaraokeColor, type LyricsKaraokeFallback, type LyricsKaraokeFill } from "./lyricsSettings";
import "./LyricsKaraokeSettingsSection.css";

/** The preview's line takes this long to fill, then starts again after a short pause. */
const PREVIEW_FILL_MS = 3_600;
const PREVIEW_LOOP_MS = 4_800;

/** A strip like the collapsed island, playing a sample line with the chosen look, over and over. */
function KaraokePreview({ settings, line }: { settings: IslandSettings; line: string }) {
  const [round, setRound] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setRound((value) => value + 1), PREVIEW_LOOP_MS);
    return () => window.clearInterval(timer);
  }, []);
  const words = useMemo(() => karaokeWords({ timeMs: 0, text: line }, PREVIEW_FILL_MS / 0.85, true) ?? [], [line]);
  const look = karaokeLook(settings, settings.taskTextColor);
  const style = { "--task-text-color": settings.taskTextColor, background: settings.islandBackgroundColor } as CSSProperties;
  return (
    <div className="lyrics-karaoke-preview" style={style} aria-hidden="true">
      <Music2 size={16} strokeWidth={1.5} absoluteStrokeWidth />
      <span className="lyrics-karaoke-preview__line">
        <KaraokeText key={`${round}:${line}:${look.follow}`} words={words} positionMs={0} playing look={look} />
      </span>
    </div>
  );
}

/** Settings → Music: how the line on the collapsed island lights up as it is sung (C30). */
export function LyricsKaraokeSettingsSection({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const text = useTranslation().settings.lyrics.karaoke;
  const set = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const on = settings.lyricsKaraoke;

  return (
    <SettingsGroup title={text.title} footer={text.hint}>
      <SettingsRow title={text.preview} searchable={false}>
        <KaraokePreview settings={settings} line={text.previewLine} />
      </SettingsRow>
      <SettingsToggleRow title={text.enabled} description={text.enabledHint} checked={on} onChange={(lyricsKaraoke) => set({ lyricsKaraoke })} />
      {on && (
        <>
          <SettingsRow
            indent
            title={text.fallback}
            description={text.fallbackHint}
            control={
              <SettingsChoice<LyricsKaraokeFallback>
                value={settings.lyricsKaraokeFallback}
                ariaLabel={text.fallback}
                options={[{ value: "line", label: text.fallbackLine }, { value: "none", label: text.fallbackNone }]}
                onChange={(lyricsKaraokeFallback) => set({ lyricsKaraokeFallback })}
              />
            }
          />
          <SettingsRow
            indent
            title={text.fill}
            control={
              <SettingsChoice<LyricsKaraokeFill>
                value={settings.lyricsKaraokeFill}
                ariaLabel={text.fill}
                options={[{ value: "smooth", label: text.fillSmooth }, { value: "word", label: text.fillWord }]}
                onChange={(lyricsKaraokeFill) => set({ lyricsKaraokeFill })}
              />
            }
          />
          <SettingsRow
            indent
            title={text.color}
            control={
              <SettingsChoice<LyricsKaraokeColor>
                value={settings.lyricsKaraokeColor}
                ariaLabel={text.color}
                options={[{ value: "ink", label: text.colorInk }, { value: "accent", label: text.colorAccent }, { value: "custom", label: text.colorCustom }]}
                onChange={(lyricsKaraokeColor) => set({ lyricsKaraokeColor })}
              />
            }
          />
          {settings.lyricsKaraokeColor === "custom" && (
            <SettingsRow
              indent
              title={text.customColor}
              control={<SettingsColor value={settings.lyricsKaraokeCustomColor} ariaLabel={text.customColor} onChange={(lyricsKaraokeCustomColor) => set({ lyricsKaraokeCustomColor })} />}
            />
          )}
          <SettingsSliderRow
            indent
            title={text.dim}
            description={text.dimHint}
            value={settings.lyricsKaraokeDim}
            min={LYRICS_KARAOKE_DIM.min}
            max={LYRICS_KARAOKE_DIM.max}
            step={5}
            format={text.dimValue}
            defaultValue={LYRICS_KARAOKE_DIM.default}
            resetLabel={text.dimReset}
            onChange={(lyricsKaraokeDim) => set({ lyricsKaraokeDim })}
          />
          <SettingsToggleRow indent title={text.glow} description={text.glowHint} checked={settings.lyricsKaraokeGlow} onChange={(lyricsKaraokeGlow) => set({ lyricsKaraokeGlow })} />
          <SettingsToggleRow indent title={text.follow} description={text.followHint} checked={settings.lyricsKaraokeFollow} onChange={(lyricsKaraokeFollow) => set({ lyricsKaraokeFollow })} />
        </>
      )}
    </SettingsGroup>
  );
}
