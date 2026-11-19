import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Play, Square } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import type { ThemeTone } from "../../../lib/theme/themeMode";
import { NoticePreviewCard, NoticePreviewPill } from "./NoticePreviewCard";
import { PREVIEW_EVENTS, PREVIEW_TONE, playSeconds, previewShow, previewStay, previewSwitch, type PreviewEvent } from "./previewEvents";
import { useFitScale } from "./useFitScale";
import type { NoticePlayback } from "./useNoticePlayback";
import "./NoticePreviewStage.css";

const COMPACT_ON = 56;
const COMPACT_OFF = 10;
const HIDDEN_KEY = { agentAlertWaiting: "waiting", agentAlertCompleted: "completed", agentAlertFailed: "failed" } as const;

export function NoticePreviewStage({
  settings,
  event,
  flash,
  notch,
  tone,
  playback,
  soundName,
  onSelect,
  onPlay,
}: {
  settings: IslandSettings;
  event: PreviewEvent;
  flash: number;
  notch: boolean;
  tone: ThemeTone;
  playback: NoticePlayback;
  soundName: string | null;
  onSelect: (event: PreviewEvent) => void;
  onPlay: () => void;
}) {
  const t = useTranslation();
  const text = t.settings.agentNotice;
  const preview = text.preview;
  const alerts = t.settings.agent.alerts;
  const rootRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const { boxRef, contentRef, scale } = useFitScale({ pad: 14 });

  useEffect(() => {
    const panel = rootRef.current?.closest(".editor-panel");
    if (!panel) return;
    const onScroll = () => setCompact((current) => panel.scrollTop > (current ? COMPACT_OFF : COMPACT_ON));
    onScroll();
    panel.addEventListener("scroll", onScroll, { passive: true });
    return () => panel.removeEventListener("scroll", onScroll);
  }, []);

  const show = previewShow(event, settings);
  const stay = previewStay(event, settings);
  const asks = event === "approval" || event === "question";
  const remindAfter = asks && settings.agentRemindSeconds > 0 ? alerts.remindValue(settings.agentRemindSeconds) : null;
  const holds = typeof stay === "number" && settings.agentNoticeHoverHold;
  const switchKey = previewSwitch(event);
  const hidden = show === "card" ? null : preview.hidden[event === "started" || !switchKey ? (show === "title" ? "title" : "none") : HIDDEN_KEY[switchKey]];

  const idleNote = () => {
    if (hidden) return hidden;
    const stayLabel = stay === "handled" ? text.stayHandled : stay === "looked" ? text.untilSeen : text.closeAfter(stay);
    return [
      preview.stay(stayLabel),
      holds ? preview.hoverHold : null,
      remindAfter ? preview.remind(remindAfter) : null,
      asks ? null : preview.clickNote[settings.agentNoticeClick],
      soundName ? preview.sound(soundName) : null,
    ].filter(Boolean).join(" · ");
  };

  const playNote = () => {
    const steps = preview.steps;
    switch (playback.step) {
      case "hidden": return hidden ?? steps.collapsed;
      case "handled": return steps.handled;
      case "remindSoon": return remindAfter ? `${steps.handled} · ${steps.remindSoon(remindAfter)}` : steps.handled;
      case "reminded": return steps.reminded;
      case "looked": return steps.looked;
      case "seconds": {
        const line = typeof stay === "number" ? steps.seconds(stay, playSeconds(stay)) : "";
        return holds ? `${line} · ${steps.hold}` : line;
      }
      case "leaving": return steps.leaving;
      case "ended": return steps.ended;
      default: return steps.collapsed;
    }
  };

  const carded = playback.playing ? playback.phase === "shown" || playback.phase === "leaving" : show === "card";
  const titled = show === "title" && (!playback.playing || playback.step === "hidden");
  const dropClass = !playback.playing ? "" : playback.phase === "leaving" ? " agent-reminder-stage__drop--out" : playback.phase === "shown" ? " agent-reminder-stage__drop--in" : "";
  const countdown = playback.countdown;
  const percent = Math.round(scale * 100);

  return (
    <section ref={rootRef} className={`agent-reminder-stage${compact ? " agent-reminder-stage--compact" : ""}`} data-search="off" aria-label={preview.label}>
      <div className="agent-reminder-stage__head">
        <div className="agent-reminder-stage__chips" role="group" aria-label={preview.label}>
          {PREVIEW_EVENTS.map((name) => {
            const active = name === event;
            return (
              <button
                key={active ? `${name}-${flash}` : name}
                className={`agent-reminder-stage__chip${active ? " agent-reminder-stage__chip--active" : ""}${active && flash > 0 ? " agent-reminder-stage__chip--flash" : ""}`}
                type="button"
                data-event={name}
                aria-pressed={active}
                onClick={() => onSelect(name)}
              >
                <i className={`agent-reminder-stage__dot agent-reminder-stage__dot--${PREVIEW_TONE[name]}`} aria-hidden="true" />
                {preview.events[name]}
              </button>
            );
          })}
        </div>
        <button className="agent-reminder-stage__play" type="button" aria-pressed={playback.playing} onClick={onPlay}>
          {playback.playing ? <Square size={11} strokeWidth={2.6} aria-hidden="true" /> : <Play size={12} strokeWidth={2.6} aria-hidden="true" />}
          {playback.playing ? preview.stop : preview.play}
        </button>
      </div>
      <div ref={boxRef} className="agent-reminder-stage__desk">
        <div ref={contentRef} className="agent-reminder-stage__fit" style={{ transform: `scale(${scale})` }}>
          <div
            key={`${event}-${carded ? playback.pops : "pill"}`}
            className={`agent-reminder-stage__drop${dropClass}`}
            onPointerEnter={() => playback.hover(true)}
            onPointerLeave={() => playback.hover(false)}
          >
            {carded ? (
              <NoticePreviewCard event={event} settings={settings} tone={tone} notch={notch} onDecide={playback.decide} />
            ) : (
              <NoticePreviewPill settings={settings} tone={tone} notch={notch} title={titled ? preview.sample.startedTitle : preview.collapsed} state={titled ? preview.running : null} />
            )}
          </div>
        </div>
        {countdown && (
          <i
            key={`${countdown.turn}-${countdown.held}`}
            className={`agent-reminder-stage__countdown${countdown.held ? "" : " agent-reminder-stage__countdown--running"}`}
            style={{ "--countdown-ms": `${Math.round(countdown.ms)}ms`, "--countdown-from": Math.min(1, countdown.ms / countdown.total) } as CSSProperties}
            aria-hidden="true"
          />
        )}
        {carded && percent < 100 && <span className="agent-reminder-stage__scale">{preview.shrunk(percent)}</span>}
      </div>
      <p className={`agent-reminder-stage__note${playback.playing ? " agent-reminder-stage__note--playing" : ""}`} aria-live="polite">
        {playback.playing ? playNote() : idleNote()}
      </p>
    </section>
  );
}
