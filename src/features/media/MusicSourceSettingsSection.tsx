import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useTranslation } from "../../i18n";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import {
  addCustomMediaPlayer,
  getCustomMediaPlayers,
  getMediaState,
  listMediaPlayerCandidates,
  removeCustomMediaPlayer,
  type CustomMediaPlayer,
  type MediaState,
} from "./api";
import { MusicSourceList } from "./MusicSourceList";
import { mergeSessionsWithCustomPlayers } from "./sourcePriority";
import { useMusicSourcePriority } from "./useMusicSourcePriority";
import "./MusicSourceSettingsSection.css";

const LIVE_SESSION_POLL_MS = 3_000;

function useLiveMediaSessions() {
  const [sessions, setSessions] = useState<MediaState["sessions"]>([]);

  useEffect(() => {
    let didCancel = false;
    const read = () => {
      void getMediaState(undefined)
        .then((state) => {
          if (!didCancel && Array.isArray(state?.sessions)) {
            setSessions(state.sessions);
          }
        })
        .catch((error) => {
          console.error("Failed to read media sessions", error);
        });
    };
    read();
    const stop = visibilityInterval(read, LIVE_SESSION_POLL_MS);
    return () => {
      didCancel = true;
      stop();
    };
  }, []);

  return sessions;
}

export function MusicSourceSettingsSection() {
  const t = useTranslation();
  const liveSessions = useLiveMediaSessions();
  const [customPlayers, setCustomPlayers] = useState<CustomMediaPlayer[]>([]);
  const [candidates, setCandidates] = useState<CustomMediaPlayer[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getCustomMediaPlayers()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setCustomPlayers(list);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!adding) {
      return;
    }
    let cancelled = false;
    void listMediaPlayerCandidates()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setCandidates(list);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adding, customPlayers]);

  const mergedSessions = useMemo(
    () => mergeSessionsWithCustomPlayers(liveSessions, customPlayers),
    [customPlayers, liveSessions],
  );

  const { musicSourcePriority, reorderMusicSource, removeMusicSource } =
    useMusicSourcePriority(mergedSessions);

  const handleAddPlayer = useCallback(async (id: string, label?: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      return;
    }
    try {
      const updated = await addCustomMediaPlayer(trimmed, label);
      if (Array.isArray(updated)) {
        setCustomPlayers(updated);
      }
      setDraft("");
      setAdding(false);
    } catch (error) {
      console.error("Failed to add custom media player", error);
    }
  }, []);

  const handleRemoveSource = useCallback(
    (sourceId: string) => {
      removeMusicSource(sourceId);
      const lowered = sourceId.toLowerCase();
      if (customPlayers.some((item) => item.id.toLowerCase() === lowered)) {
        void removeCustomMediaPlayer(sourceId)
          .then((updated) => {
            if (Array.isArray(updated)) {
              setCustomPlayers(updated);
            }
          })
          .catch(() => {});
      }
    },
    [customPlayers, removeMusicSource],
  );

  return (
    <SettingsGroup title={t.music.settingsTitle} footer={t.music.settingsHint}>
      <div className="music-source-settings">
        <MusicSourceList
          sourcePriority={musicSourcePriority}
          liveSessions={liveSessions}
          onReorderSource={reorderMusicSource}
          onRemoveSource={handleRemoveSource}
        />
        <div className="music-custom-player">
          {!adding ? (
            <button
              type="button"
              className="music-custom-player__trigger"
              onClick={() => setAdding(true)}
            >
              <Plus size={13} strokeWidth={2.3} aria-hidden="true" />
              <span>{t.music.customPlayer.add}</span>
            </button>
          ) : (
            <div className="music-custom-player__panel">
              <form
                className="music-custom-player__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAddPlayer(draft);
                }}
              >
                <input
                  type="text"
                  className="music-custom-player__input"
                  value={draft}
                  placeholder={t.music.customPlayer.placeholder}
                  aria-label={t.music.customPlayer.placeholder}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button
                  type="submit"
                  className="music-custom-player__button music-custom-player__button--primary"
                  disabled={!draft.trim()}
                >
                  {t.music.customPlayer.submit}
                </button>
                <button
                  type="button"
                  className="music-custom-player__button"
                  onClick={() => {
                    setAdding(false);
                    setDraft("");
                  }}
                >
                  {t.music.customPlayer.cancel}
                </button>
              </form>
              {candidates.length > 0 && (
                <div className="music-custom-player__candidates">
                  <span className="music-custom-player__candidates-label">
                    {t.music.customPlayer.running}
                  </span>
                  {candidates.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="music-custom-player__chip"
                      onClick={() => void handleAddPlayer(item.id, item.label)}
                    >
                      <Plus size={11} strokeWidth={2.4} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SettingsGroup>
  );
}
