import { useEffect, useState } from "react";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { activeTone } from "../../../lib/theme/themeMode";
import { useSystemDark } from "../../../lib/theme/useResolvedTheme";
import { agentNoticeDefaults } from "../agentNoticeDefaults";
import { islandHasNotch } from "../api";
import { previewAgentSound } from "../sounds/player";
import { useAgentSoundSettings } from "../sounds/useAgentSoundSettings";
import { NoticeLookGroups } from "./NoticeLookGroups";
import { NoticePreviewStage } from "./NoticePreviewStage";
import { PREVIEW_SOUND, focusedEvent, type PreviewEvent } from "./previewEvents";
import { ReminderEventRows } from "./ReminderEventRows";
import { useNoticePlayback } from "./useNoticePlayback";
import "./AgentReminderSettings.css";

export function AgentReminderSettings({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const t = useTranslation();
  const [event, setEvent] = useState<PreviewEvent>("approval");
  const [flash, setFlash] = useState(0);
  const [notch, setNotch] = useState(false);
  const [sounds] = useAgentSoundSettings();
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
  const audition = (name: PreviewEvent) => void previewAgentSound(PREVIEW_SOUND[name], sounds.pack, sounds.volume);
  const playback = useNoticePlayback({
    event,
    settings,
    onSound: () => {
      if (audible(event)) audition(event);
    },
  });

  const select = (name: PreviewEvent) => {
    playback.stop();
    setEvent(name);
  };
  const update = (patch: Partial<IslandSettings>) => {
    playback.stop();
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
      />
      <ReminderEventRows settings={settings} event={event} onUpdate={update} onSelect={select} onAudition={audition} />
      <NoticeLookGroups settings={settings} event={event} tone={tone} notch={notch} onUpdate={update} onReset={reset} />
    </div>
  );
}
