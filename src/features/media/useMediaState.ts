import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getMediaState, sendMediaCommand, type AudioLevel, type MediaCommand, type MediaPlaybackStatus, type MediaSessionChange, type MediaState } from "./api";
import { audioPeakStore } from "./audioPeakStore";
import { DEFAULT_MEDIA_STATE, isSameMediaState } from "./mediaState";
import { playbackPosition } from "./lyrics/lrc";
import { alignClock, clockPosition, hasTimeline, holdIntentTimeline, keepIslandTimeline, NO_CLOCK, settleClockAt, startClockAt, type TrackClock } from "./trackClock";
import { useMediaSessionChanges } from "./useMediaSessionChanges";
import { pickEffectiveMediaTarget } from "./sourcePriority";
import { useMusicSourcePriority } from "./useMusicSourcePriority";

const FALLBACK_POLL_MS = 30_000;

export function useMediaState(enabled = true) {
  const [mediaState, setMediaState] =
    useState<MediaState>(DEFAULT_MEDIA_STATE);
  const [isMediaTrackChanging, setIsMediaTrackChanging] = useState(false);
  const [mediaCommandError, setMediaCommandError] = useState<string | null>(
    null,
  );
  const mediaStateRef = useRef(mediaState);
  mediaStateRef.current = mediaState;
  const mediaTargetRef = useRef<string | null>(null);
  const isRefreshingMediaState = useRef(false);
  const isRunningMediaCommand = useRef(false);
  const trackClock = useRef<TrackClock>(NO_CLOCK);
  const pendingChanges = useRef<MediaSessionChange[]>([]);
  const mediaPlaybackIntent = useRef<{
    status: MediaPlaybackStatus;
    expiresAt: number;
    holdPosition: boolean;
  } | null>(null);
  const { musicSourcePriority, reorderMusicSource, removeMusicSource } =
    useMusicSourcePriority(mediaState.sessions);

  const refreshMediaState = useCallback(async function refresh(change?: MediaSessionChange): Promise<void> {
    if (isRefreshingMediaState.current) {
      if (change) pendingChanges.current.push(change);
      return;
    }

    isRefreshingMediaState.current = true;

    try {
      const nextMediaState = await getMediaState(
        mediaTargetRef.current ?? undefined,
      );

      const now = Date.now();
      const intent = mediaPlaybackIntent.current;
      const intentActive = intent !== null && now < intent.expiresAt;
      const holdPosition = intentActive && intent.holdPosition;
      const playbackStatus = intentActive
        ? intent.status
        : nextMediaState.playbackStatus;

      if (intent && now >= intent.expiresAt) {
        mediaPlaybackIntent.current = null;
      }

      const untimed = nextMediaState.title && !hasTimeline(nextMediaState)
        ? `${nextMediaState.sourceApp ?? ""}\u001f${nextMediaState.title}\u001f${nextMediaState.artist ?? ""}`
        : null;
      const event = change && (change.sessionId === null || change.sessionId === nextMediaState.activeSessionId) ? change : null;
      const playing = playbackStatus === "playing";
      trackClock.current = !untimed
        ? NO_CLOCK
        : event?.kind === "track"
          ? startClockAt(trackClock.current, untimed, playing, event.at, now)
          : settleClockAt(trackClock.current, untimed, playing, event ? event.at : now, now);
      const timeline = untimed
        ? { positionMs: clockPosition(trackClock.current, now), updatedAt: now, positionEstimate: trackClock.current.fromStart ? "timed" as const : "unsure" as const }
        : {};

      const audioActive = audioPeakStore.mergeSnapshot(
        nextMediaState.audioPeak,
        nextMediaState.audioActive,
        playbackStatus === "paused",
      );

      setMediaState((currentState) => {
        const merged: MediaState = {
          ...(holdPosition ? holdIntentTimeline(nextMediaState, currentState) : nextMediaState),
          ...timeline,
          audioActive,
          audioPeak: 0,
          playbackStatus,
        };

        if (isSameMediaState(currentState, merged)) {
          return currentState;
        }

        return merged;
      });
    } catch (error) {
      console.error("Failed to read media state", error);
      audioPeakStore.set(0);
      setMediaState(DEFAULT_MEDIA_STATE);
    } finally {
      isRefreshingMediaState.current = false;
      const next = pendingChanges.current.shift();
      if (next) void refresh(next);
    }
  }, []);

  const runMediaCommand = useCallback(
    async (command: MediaCommand) => {
      if (isRunningMediaCommand.current) {
        return;
      }

      const target = mediaTargetRef.current ?? undefined;
      const isPlayPause = command === "media_play_pause";
      const isTrackChange =
        command === "media_next" || command === "media_previous";
      const isTransport = isPlayPause || isTrackChange;

      const intendedStatus: MediaPlaybackStatus = isPlayPause
        ? mediaState.playbackStatus === "playing"
          ? "paused"
          : "playing"
        : mediaState.playbackStatus;

      if (isTransport) {
        mediaPlaybackIntent.current = {
          status: intendedStatus,
          expiresAt: Date.now() + (isPlayPause ? 1200 : 1800),
          holdPosition: isPlayPause,
        };

        if (isPlayPause) {
          if (intendedStatus === "paused") {
            audioPeakStore.set(0);
          }
          setMediaState((currentState) => ({
            ...currentState,
            available: intendedStatus === "playing" || currentState.available,
            audioActive:
              intendedStatus === "playing" && currentState.audioActive,
            audioPeak: 0,
            playbackStatus: intendedStatus,
            positionMs: Math.round(playbackPosition(currentState, Date.now())),
            updatedAt: Date.now(),
          }));
        }
      }

      isRunningMediaCommand.current = true;
      setIsMediaTrackChanging(isTrackChange);
      setMediaCommandError(null);
      try {
        const nextMediaState = await sendMediaCommand(command, target);

        if (!isTransport) {
          audioPeakStore.mergeSnapshot(
            nextMediaState.audioPeak,
            nextMediaState.audioActive,
            nextMediaState.playbackStatus === "paused",
          );
          setMediaState((currentState) => {
            const settled = { ...keepIslandTimeline(nextMediaState, currentState), audioPeak: 0 };
            return isSameMediaState(currentState, settled) ? currentState : settled;
          });
          return;
        }

        if (intendedStatus === "paused") {
          audioPeakStore.set(0);
        } else {
          audioPeakStore.mergeSnapshot(nextMediaState.audioPeak, nextMediaState.audioActive, false);
        }

        setMediaState((currentState) => {
          const timed = keepIslandTimeline(nextMediaState, currentState);
          const settled = isPlayPause ? holdIntentTimeline(timed, currentState) : timed;
          if (intendedStatus === "paused") {
            return {
              ...settled,
              audioActive: false,
              audioPeak: 0,
              playbackStatus: intendedStatus,
            };
          }

          return {
            ...settled,
            audioActive:
              nextMediaState.audioActive || currentState.audioActive,
            audioPeak: 0,
            playbackStatus: intendedStatus,
          };
        });
      } catch (error) {
        console.error(`Failed to run media command: ${command}`, error);
        setMediaCommandError(String(error));
        mediaPlaybackIntent.current = null;
        await refreshMediaState();
      } finally {
        isRunningMediaCommand.current = false;
        setIsMediaTrackChanging(false);
      }
    },
    [mediaState.playbackStatus, refreshMediaState],
  );

  const applyAudioLevel = useCallback((audioLevel: AudioLevel) => {
    const intent = mediaPlaybackIntent.current;
    const isPauseIntent =
      intent !== null &&
      Date.now() < intent.expiresAt &&
      intent.status === "paused";
    const current = mediaStateRef.current;

    if (current.playbackStatus === "paused" || isPauseIntent) {
      audioPeakStore.set(0);
      if (current.playbackStatus === "paused" && !current.audioActive) {
        return;
      }
      setMediaState((prev) =>
        prev.playbackStatus === "paused" && !prev.audioActive
          ? prev
          : { ...prev, audioActive: false, audioPeak: 0, playbackStatus: "paused" },
      );
      return;
    }

    const audioActive = audioPeakStore.sample(audioLevel.peak, audioLevel.active);
    if (current.audioActive === audioActive) {
      return;
    }
    setMediaState((prev) => (prev.audioActive === audioActive ? prev : { ...prev, audioActive, audioPeak: 0 }));
  }, []);

  useMediaSessionChanges(enabled, refreshMediaState);

  useEffect(() => {
    if (!enabled) {
      audioPeakStore.set(0);
      setMediaState(DEFAULT_MEDIA_STATE);
      return;
    }

    void refreshMediaState();

    return visibilityInterval(() => {
      void refreshMediaState();
    }, FALLBACK_POLL_MS);
  }, [enabled, refreshMediaState]);

  const effectiveMediaTarget = useMemo(
    () => pickEffectiveMediaTarget(mediaState.sessions, musicSourcePriority),
    [musicSourcePriority, mediaState.sessions],
  );

  useEffect(() => {
    if (!enabled || mediaTargetRef.current === effectiveMediaTarget) {
      return;
    }
    mediaTargetRef.current = effectiveMediaTarget;
    mediaPlaybackIntent.current = null;
    void refreshMediaState();
  }, [effectiveMediaTarget, enabled, refreshMediaState]);

  const alignPosition = useCallback((positionMs: number) => {
    if (trackClock.current.key === null) return;
    const now = Date.now();
    trackClock.current = alignClock(trackClock.current, positionMs, now);
    setMediaState((current) => ({ ...current, positionMs: Math.max(0, positionMs), updatedAt: now, positionEstimate: "timed" }));
  }, []);

  return useMemo(() => ({
    mediaState,
    alignPosition,
    applyAudioLevel,
    isMediaTrackChanging,
    mediaCommandError,
    musicSourcePriority,
    runMediaCommand,
    reorderMusicSource,
    removeMusicSource,
  }), [
    mediaState,
    alignPosition,
    applyAudioLevel,
    isMediaTrackChanging,
    mediaCommandError,
    musicSourcePriority,
    runMediaCommand,
    reorderMusicSource,
    removeMusicSource,
  ]);
}
