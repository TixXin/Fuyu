use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, Sender},
        Mutex, PoisonError,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};
use windows::{
    Foundation::TypedEventHandler,
    Media::Control::{
        GlobalSystemMediaTransportControlsSession as MediaSession,
        GlobalSystemMediaTransportControlsSessionManager as MediaSessionManager,
    },
};

use super::audio::{read_system_audio_peak, AUDIO_ACTIVE_THRESHOLD};
use super::audio_fallback::discover_fallback_sessions_with_devices;
use super::cache::{merge_burst, BurstSignal, TimelineGate, TimelineSample, COALESCE_MS};
use super::session::{
    current_unix_millis, is_playing, list_sessions, media_error, request_manager, session_id,
    ticks_to_ms,
};
use crate::win32::{self, audio::CachedRenderAudio};

pub(crate) const MEDIA_SESSION_CHANGED_EVENT: &str = "media-session-changed";

const FALLBACK_WATCH_STEP: Duration = Duration::from_millis(1200);
const QUIET_GRACE: Duration = Duration::from_millis(300);
const SOUND_WAIT: Duration = Duration::from_millis(2000);
const SOUND_STEP: Duration = Duration::from_millis(30);
const DUPLICATE_TRACK_COOLDOWN: Duration = Duration::from_millis(1500);

static METADATA_EPOCH: AtomicU64 = AtomicU64::new(1);

pub(super) fn metadata_epoch() -> u64 {
    METADATA_EPOCH.load(Ordering::Acquire)
}

pub(super) fn bump_metadata_epoch() {
    METADATA_EPOCH.fetch_add(1, Ordering::AcqRel);
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionChange {
    kind: &'static str,
    at: i64,
    session_id: Option<String>,
}

enum Signal {
    Stop,
    Sessions,
    Track(Option<String>, i64),
    Playback(Option<String>, i64),
    Timeline(Option<String>, i64),
}

struct Watched {
    id: Option<String>,
    session: MediaSession,
    properties_token: i64,
    playback_token: i64,
    timeline_token: i64,
}

struct Running {
    stop: Sender<Signal>,
    thread: JoinHandle<()>,
}

static RUNNING: Mutex<Option<Running>> = Mutex::new(None);

pub(super) fn start(app: &AppHandle) -> Result<(), String> {
    let mut slot = RUNNING.lock().unwrap_or_else(PoisonError::into_inner);
    if slot
        .as_ref()
        .is_some_and(|running| !running.thread.is_finished())
    {
        return Ok(());
    }
    let app = app.clone();
    let (sender, signals) = mpsc::channel();
    let to_thread = sender.clone();
    let thread = thread::Builder::new()
        .name("media-session-events".into())
        .spawn(move || {
            if let Err(error) = watch(&app, to_thread, signals) {
                eprintln!("media session events are off, fallback poll stays: {error}");
            }
        })
        .map_err(|error| format!("Could not start the media session events: {error}"))?;
    *slot = Some(Running {
        stop: sender,
        thread,
    });
    Ok(())
}

pub(super) fn stop() {
    let running = RUNNING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take();
    if let Some(running) = running {
        let _ = running.stop.send(Signal::Stop);
        let _ = running.thread.join();
    }
}

pub(super) fn running() -> bool {
    RUNNING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .as_ref()
        .is_some_and(|running| !running.thread.is_finished())
}

fn drain_burst(
    signals: &Receiver<Signal>,
    first: BurstSignal,
) -> Option<(BurstSignal, bool)> {
    let deadline = Instant::now() + Duration::from_millis(COALESCE_MS);
    let mut had_playback = matches!(first, BurstSignal::Playback(_, _));
    let mut current = first;
    while let Some(left) = deadline.checked_duration_since(Instant::now()) {
        match signals.recv_timeout(left) {
            Ok(Signal::Stop) | Err(RecvTimeoutError::Disconnected) => return None,
            Ok(Signal::Sessions) => current = merge_burst(current, BurstSignal::Sessions),
            Ok(Signal::Track(id, at)) => {
                current = merge_burst(current, BurstSignal::Track(id, at));
            }
            Ok(Signal::Playback(id, at)) => {
                had_playback = true;
                current = merge_burst(current, BurstSignal::Playback(id, at));
            }
            Ok(Signal::Timeline(_, _)) => {}
            Err(RecvTimeoutError::Timeout) => break,
        }
    }
    Some((current, had_playback))
}

fn timeline_sample(session: &MediaSession, at_ms: i64) -> Option<TimelineSample> {
    let timeline = session.GetTimelineProperties().ok()?;
    let start = timeline.StartTime().map(ticks_to_ms).unwrap_or(0);
    let end = timeline.EndTime().map(ticks_to_ms).unwrap_or(0);
    let position = timeline.Position().map(ticks_to_ms).unwrap_or(0);
    let duration = (end - start).max(0);
    if duration == 0 {
        return None;
    }
    Some(TimelineSample {
        position_ms: (position - start).clamp(0, duration),
        duration_ms: duration,
        at_ms,
    })
}

fn watch(app: &AppHandle, sender: Sender<Signal>, signals: Receiver<Signal>) -> Result<(), String> {
    let _apartment = win32::com::ComApartment::multithreaded()
        .map_err(|error| media_error("Failed to initialize the media events thread", error))?;
    let mut audio: Option<CachedRenderAudio> = CachedRenderAudio::open().ok();
    let manager = request_manager()?;
    let to_thread = sender.clone();
    let sessions_token = manager
        .SessionsChanged(&TypedEventHandler::new(move |_, _| {
            let _ = to_thread.send(Signal::Sessions);
            Ok(())
        }))
        .map_err(|error| media_error("Failed to watch the media sessions", error))?;
    let to_thread = sender.clone();
    let current_token = manager
        .CurrentSessionChanged(&TypedEventHandler::new(move |_, _| {
            let _ = to_thread.send(Signal::Sessions);
            Ok(())
        }))
        .map_err(|error| media_error("Failed to watch the current media session", error))?;

    let mut songs: HashMap<Option<String>, String> = HashMap::new();
    let mut same_track_emits: HashMap<Option<String>, Instant> = HashMap::new();
    let mut timeline_gate = TimelineGate::default();
    let mut watched = Vec::new();
    let mut resubscribe = true;
    let mut last_fallback: Option<(String, bool, Option<String>, Option<String>)> = None;

    let result = loop {
        if resubscribe {
            resubscribe = false;
            unsubscribe(&watched);
            watched = subscribe(&manager, &sender);
            songs.clear();
            same_track_emits.clear();
            for entry in &watched {
                songs.entry(entry.id.clone()).or_insert_with(|| song(&entry.session));
            }
        }
        let initial_burst = match signals.recv_timeout(FALLBACK_WATCH_STEP) {
            Ok(Signal::Stop) | Err(RecvTimeoutError::Disconnected) => break Ok(()),
            Ok(Signal::Sessions) => Some(BurstSignal::Sessions),
            Ok(Signal::Track(id, at)) => Some(BurstSignal::Track(id, at)),
            Ok(Signal::Playback(id, at)) => Some(BurstSignal::Playback(id, at)),
            Ok(Signal::Timeline(id, at)) => {
                let sample = watched
                    .iter()
                    .find(|entry| entry.id == id)
                    .and_then(|entry| timeline_sample(&entry.session, at));
                if timeline_gate.should_emit(id.as_deref(), sample, current_unix_millis()) {
                    emit(app, "playback", at, id);
                }
                None
            }
            Err(RecvTimeoutError::Timeout) => {
                check_fallback_changes(
                    app,
                    &manager,
                    &watched,
                    &mut audio,
                    &mut last_fallback,
                );
                None
            }
        };

        let Some(first) = initial_burst else {
            continue;
        };
        let Some((settled, had_playback)) = drain_burst(&signals, first) else {
            break Ok(());
        };
        match settled {
            BurstSignal::Sessions => {
                bump_metadata_epoch();
                timeline_gate.reset();
                resubscribe = true;
                emit(app, "playback", current_unix_millis(), None);
            }
            BurstSignal::Playback(id, at) => emit(app, "playback", at, id),
            BurstSignal::Track(id, at) => {
                bump_metadata_epoch();
                let Some(entry) = watched.iter().find(|entry| entry.id == id) else {
                    continue;
                };
                let now = song(&entry.session);
                if songs.get(&id) == Some(&now) {
                    let allow_duplicate = had_playback
                        || same_track_emits
                            .get(&id)
                            .is_none_or(|last| last.elapsed() >= DUPLICATE_TRACK_COOLDOWN);
                    if allow_duplicate {
                        same_track_emits.insert(id.clone(), Instant::now());
                        emit(app, "playback", at, id);
                    }
                    continue;
                }
                songs.insert(id.clone(), now);
                same_track_emits.insert(id.clone(), Instant::now());
                emit(app, "track", sound_onset(&mut audio, at), id);
            }
        }
    };

    unsubscribe(&watched);
    let _ = manager.RemoveSessionsChanged(sessions_token);
    let _ = manager.RemoveCurrentSessionChanged(current_token);
    drop(watched);
    drop(manager);
    drop(audio);
    result
}

fn check_fallback_changes(
    app: &AppHandle,
    manager: &MediaSessionManager,
    watched: &[Watched],
    audio: &mut Option<CachedRenderAudio>,
    last_fallback: &mut Option<(String, bool, Option<String>, Option<String>)>,
) {
    if watched.iter().any(|entry| is_playing(&entry.session)) {
        *last_fallback = None;
        return;
    }
    let audible = read_system_audio_peak(audio).is_ok_and(|peak| peak > AUDIO_ACTIVE_THRESHOLD);
    if !audible && last_fallback.as_ref().is_none_or(|(_, playing, _, _)| !*playing) {
        return;
    }
    let now_ms = current_unix_millis();
    let fallbacks = discover_fallback_sessions_with_devices(
        audio.as_ref().map(|cached| cached.devices()),
        &list_sessions(manager),
        now_ms,
    );
    let next = fallbacks
        .iter()
        .find(|entry| entry.playing)
        .or_else(|| fallbacks.first())
        .map(|entry| {
            (
                entry.id.clone(),
                entry.playing,
                entry.title.clone(),
                entry.artist.clone(),
            )
        });
    if &next == last_fallback {
        return;
    }
    let kind = match (&last_fallback, &next) {
        (Some((_, _, old_title, old_artist)), Some((_, true, new_title, new_artist)))
            if (old_title != new_title || old_artist != new_artist) && new_title.is_some() =>
        {
            "track"
        }
        (None, Some((_, true, new_title, _))) if new_title.is_some() => "track",
        _ => "playback",
    };
    let session_id = next
        .as_ref()
        .map(|(id, _, _, _)| id.clone())
        .or_else(|| last_fallback.as_ref().map(|(id, _, _, _)| id.clone()));
    *last_fallback = next;
    emit(app, kind, now_ms, session_id);
}

fn subscribe(manager: &MediaSessionManager, sender: &Sender<Signal>) -> Vec<Watched> {
    let Ok(sessions) = manager.GetSessions() else {
        return Vec::new();
    };
    sessions
        .into_iter()
        .filter_map(|session| {
            let id = session_id(&session);
            let (tx, track_id) = (sender.clone(), id.clone());
            let properties_token = session
                .MediaPropertiesChanged(&TypedEventHandler::new(move |_, _| {
                    let _ = tx.send(Signal::Track(track_id.clone(), current_unix_millis()));
                    Ok(())
                }))
                .ok()?;
            let (tx, playback_id) = (sender.clone(), id.clone());
            let playback_token = session
                .PlaybackInfoChanged(&TypedEventHandler::new(move |_, _| {
                    let _ = tx.send(Signal::Playback(playback_id.clone(), current_unix_millis()));
                    Ok(())
                }))
                .ok()?;
            let (tx, timeline_id) = (sender.clone(), id.clone());
            let timeline_token = session
                .TimelinePropertiesChanged(&TypedEventHandler::new(move |_, _| {
                    let _ = tx.send(Signal::Timeline(timeline_id.clone(), current_unix_millis()));
                    Ok(())
                }))
                .ok()?;
            Some(Watched {
                id,
                session,
                properties_token,
                playback_token,
                timeline_token,
            })
        })
        .collect()
}

fn unsubscribe(watched: &[Watched]) {
    for entry in watched {
        let _ = entry.session.RemoveMediaPropertiesChanged(entry.properties_token);
        let _ = entry.session.RemovePlaybackInfoChanged(entry.playback_token);
        let _ = entry.session.RemoveTimelinePropertiesChanged(entry.timeline_token);
    }
}

fn song(session: &MediaSession) -> String {
    let Ok(operation) = session.TryGetMediaPropertiesAsync() else {
        return String::new();
    };
    let Ok(properties) = pollster::block_on(operation) else {
        return String::new();
    };
    let title = properties
        .Title()
        .map(|value| value.to_string())
        .unwrap_or_default();
    let artist = properties
        .Artist()
        .map(|value| value.to_string())
        .unwrap_or_default();
    format!("{title}\u{1f}{artist}")
}

fn sound_onset(audio: &mut Option<CachedRenderAudio>, changed_at: i64) -> i64 {
    let started = Instant::now();
    let mut quiet = false;
    while started.elapsed() < SOUND_WAIT {
        let loud = read_system_audio_peak(audio).map_or(true, |peak| peak > AUDIO_ACTIVE_THRESHOLD);
        if !loud {
            quiet = true;
        } else if quiet {
            return current_unix_millis();
        } else if started.elapsed() > QUIET_GRACE {
            return changed_at;
        }
        thread::sleep(SOUND_STEP);
    }
    changed_at
}

fn emit(app: &AppHandle, kind: &'static str, at: i64, session_id: Option<String>) {
    let _ = app.emit(
        MEDIA_SESSION_CHANGED_EVENT,
        SessionChange {
            kind,
            at,
            session_id,
        },
    );
}
