import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { activeTone } from "../../../lib/theme/themeMode";
import { useSystemDark } from "../../../lib/theme/useResolvedTheme";
import { agentNoticeDefaults } from "../agentNoticeDefaults";
import { islandHasNotch } from "../api";
import { useAgentPushSettings } from "../push/useAgentPushSettings";
import type { AgentSoundEvent } from "../sounds/events";
import { previewAgentSound } from "../sounds/player";
import { useAgentSoundSettings } from "../sounds/useAgentSoundSettings";
import { EventTable, type AlertChannelPage } from "./EventTable";
import { NoticeLookGroups } from "./NoticeLookGroups";
import { NoticeStayGroup } from "./NoticeStayGroup";
import { NoticePreviewStage } from "./NoticePreviewStage";
import { PREVIEW_SOUND, focusedEvent, type PreviewEvent } from "./previewEvents";
import { previewSamples } from "./previewSamples";
import { useIslandTest } from "./useIslandTest";
import { useNoticePlayback } from "./useNoticePlayback";
import "./AgentReminderSettings.css";

export type ReminderView = "events" | "look";

export function AgentReminderSettings({
  view,
  settings,
  onSettingsChange,
  onShowPage,
}: {
  view: ReminderView;
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onShowPage?: (page: AlertChannelPage) => void;
}) {
  const t = useTranslation();
  const [event, setEvent] = useState<PreviewEvent>("approval");
  const [flash, setFlash] = useState(0);
  const [notch, setNotch] = useState(false);
  const [sounds, setSounds] = useAgentSoundSettings();
  const [push, setPush] = useAgentPushSettings();
  const tone = activeTone(settings.themeMode, useSystemDark());

  useEffect(() => {
    let alive = true;
    void islandHasNotch()
      .then((found) => {
        if (alive) setNotch(found);
      })
      .catch((error: unknown) => console.error("Failed to read the island notch", error));
    return () => {
      alive = false;
    };
  }, []);

  const audible = (name: PreviewEvent) => sounds.enabled && sounds.events[PREVIEW_SOUND[name]] && sounds.volume > 0;
  const play = (sound: AgentSoundEvent) => void previewAgentSound(sound, sounds.pack, sounds.volume);
  const playback = useNoticePlayback({
    event,
    settings,
    onSound: () => {
      if (audible(event)) play(PREVIEW_SOUND[event]);
    },
  });

  const islandTest = useIslandTest();
  const sample = t.settings.agentNotice.preview.sample;
  const samples = useMemo(() => previewSamples(sample), [sample]);

  const select = (name: PreviewEvent) => {
    playback.stop();
    islandTest.clear();
    setEvent(name);
  };
  const update = (patch: Partial<IslandSettings>) => {
    playback.stop();
    islandTest.clear();
    const next = focusedEvent(event, Object.keys(patch));
    if (next !== event) {
      setEvent(next);
      setFlash((count) => count + 1);
    }
    onSettingsChange({ ...settings, ...patch });
  };
  const reset = () => {
    playback.stop();
    onSettingsChange({ ...settings, ...agentNoticeDefaults() });
  };

  return (
    <div className="agent-reminder">
      <NoticePreviewStage
        settings={settings}
        event={event}
        flash={flash}
        notch={notch}
        tone={tone}
        playback={playback}
        soundName={audible(event) ? t.settings.sounds.events[PREVIEW_SOUND[event]].title : null}
        onSelect={select}
        onPlay={playback.playing ? playback.stop : playback.start}
        islandTest={islandTest}
        onTest={() => islandTest.run(event, samples)}
      />
      {view === "events" ? (
        <EventTable
          settings={settings}
          event={event}
          sounds={sounds}
          push={push}
          onUpdate={update}
          onSounds={(events) => setSounds((current) => ({ ...current, events }))}
          onPush={(events) => setPush((current) => ({ ...current, events }))}
          onSelect={select}
          onAudition={play}
          onShowPage={onShowPage}
        />
      ) : (
        <>
          <NoticeStayGroup settings={settings} event={event} onUpdate={update} onSelect={select} />
          <NoticeLookGroups settings={settings} event={event} tone={tone} notch={notch} onUpdate={update} onReset={reset} />
        </>
      )}
    </div>
  );
}
