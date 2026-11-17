use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
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
use super::audio_fallback::discover_fallback_sessions;
use super::session::{current_unix_millis, is_playing, list_sessions, media_error, request_manager, session_id};
use crate::win32;

pub(crate) const MEDIA_SESSION_CHANGED_EVENT: &str = "media-session-changed";

const FALLBACK_WATCH_STEP: Duration = Duration::from_millis(1200);
const QUIET_GRACE: Duration = Duration::from_millis(300);
const SOUND_WAIT: Duration = Duration::from_millis(2000);
const SOUND_STEP: Duration = Duration::from_millis(15);

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
    if slot.as_ref().is_some_and(|running| !running.thread.is_finished()) {
        return Ok(());
    }
    let app = app.clone();
    let (sender, signals) = mpsc::channel();
    let to_thread = sender.clone();
    let thread = thread::Builder::new()
        .name("media-session-events".into())
        .spawn(move || {
            if let Err(error) = watch(&app, to_thread, signals) {
                eprintln!("media session events are off, the 1.5 s poll stays: {error}");
            }
        })
        .map_err(|error| format!("Could not start the media session events: {error}"))?;
    *slot = Some(Running { stop: sender, thread });
    Ok(())
}

pub(super) fn stop() {
    let running = RUNNING.lock().unwrap_or_else(PoisonError::into_inner).take();
    if let Some(running) = running {
        let _ = running.stop.send(Signal::Stop);
        let _ = running.thread.join();
    }
}

pub(super) fn running() -> bool {
    RUNNING.lock().unwrap_or_else(PoisonError::into_inner).as_ref().is_some_and(|running| !running.thread.is_finished())
}

fn watch(app: &AppHandle, sender: Sender<Signal>, signals: Receiver<Signal>) -> Result<(), String> {
    let _apartment = win32::com::ComApartment::multithreaded()
        .map_err(|error| media_error("Failed to initialize the media events thread", error))?;
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
    let mut watched = Vec::new();
    let mut resubscribe = true;
    let mut last_fallback: Option<(String, bool, Option<String>, Option<String>)> = None;
    loop {
        if resubscribe {
            resubscribe = false;
            unsubscribe(&watched);
            watched = subscribe(&manager, &sender);
            for entry in &watched {
                songs.entry(entry.id.clone()).or_insert_with(|| song(&entry.session));
            }
        }
        match signals.recv_timeout(FALLBACK_WATCH_STEP) {
            Ok(Signal::Stop) | Err(RecvTimeoutError::Disconnected) => {
                unsubscribe(&watched);
                let _ = manager.RemoveSessionsChanged(sessions_token);
                let _ = manager.RemoveCurrentSessionChanged(current_token);
                return Ok(());
            }
            Ok(Signal::Sessions) => {
                resubscribe = true;
                emit(app, "playback", current_unix_millis(), None);
            }
            Ok(Signal::Playback(id, at)) => emit(app, "playback", at, id),
            Ok(Signal::Track(id, at)) => {
                let Some(entry) = watched.iter().find(|entry| entry.id == id) else { continue };
                let now = song(&entry.session);
                if songs.get(&id) == Some(&now) {
                    continue;
                }
                songs.insert(id.clone(), now);
                emit(app, "track", sound_onset(at), id);
            }
            Err(RecvTimeoutError::Timeout) => {
                check_fallback_changes(app, &manager, &watched, &mut last_fallback);
            }
        }
    }
}

fn check_fallback_changes(
    app: &AppHandle,
    manager: &MediaSessionManager,
    watched: &[Watched],
    last_fallback: &mut Option<(String, bool, Option<String>, Option<String>)>,
) {
    let audible = read_system_audio_peak().is_ok_and(|peak| peak > AUDIO_ACTIVE_THRESHOLD);
    if !audible && last_fallback.as_ref().is_none_or(|(_, playing, _, _)| !*playing) {
        return;
    }
    if watched.iter().any(|entry| is_playing(&entry.session)) {
        *last_fallback = None;
        return;
    }
    let now_ms = current_unix_millis();
    let fallbacks = discover_fallback_sessions(&list_sessions(manager), now_ms);
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
    let Ok(sessions) = manager.GetSessions() else { return Vec::new() };
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
                    let _ = tx.send(Signal::Playback(timeline_id.clone(), current_unix_millis()));
                    Ok(())
                }))
                .ok()?;
            Some(Watched { id, session, properties_token, playback_token, timeline_token })
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
    let Ok(operation) = session.TryGetMediaPropertiesAsync() else { return String::new() };
    let Ok(properties) = pollster::block_on(operation) else { return String::new() };
    let title = properties.Title().map(|value| value.to_string()).unwrap_or_default();
    let artist = properties.Artist().map(|value| value.to_string()).unwrap_or_default();
    format!("{title}\u{1f}{artist}")
}

fn sound_onset(changed_at: i64) -> i64 {
    let started = Instant::now();
    let mut quiet = false;
    while started.elapsed() < SOUND_WAIT {
        let loud = read_system_audio_peak().map_or(true, |peak| peak > AUDIO_ACTIVE_THRESHOLD);
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
    let _ = app.emit(MEDIA_SESSION_CHANGED_EVENT, SessionChange { kind, at, session_id });
}
