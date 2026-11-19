use super::{choose, merge, published, repeat_label, same_app, AdapterApp, AudioPlayer, MediaSessionInfo, MediaState};
use crate::media_control::players::CustomMediaPlayer;
use serde_json::json;

#[test]
fn the_adapter_payload_becomes_a_published_timeline() {
    let info = json!({ "elapsedTime": 10.0, "playbackRate": 1.0, "duration": 200.0, "timestamp": "2026-11-13T17:52:33Z" });
    let timeline = published(info.as_object().unwrap(), 0);
    assert_eq!(timeline.position_ms, 10_000);
    assert_eq!(timeline.updated_ms, Some(1_794_592_353_000));
    assert_eq!(timeline.duration_ms, 200_000);
    let bare = json!({ "elapsedTime": 3.5 });
    let timeline = published(bare.as_object().unwrap(), 42);
    assert_eq!((timeline.position_ms, timeline.updated_ms, timeline.duration_ms), (3_500, Some(42), 0));
    assert_eq!(repeat_label(Some(3.0)), "list");
    assert_eq!(repeat_label(None), "unknown");
}

fn adapter_state(title: Option<&str>, playing: bool) -> MediaState {
    let playing = playing && title.is_some();
    let source = "com.soda.music".to_string();
    MediaState {
        available: true,
        audio_active: playing,
        playback_status: if playing { "playing" } else { "paused" },
        title: title.map(str::to_string),
        artist: Some("歌手".to_string()),
        thumbnail: Some("data:image/jpeg;base64,AA==".to_string()),
        position_ms: if playing { 12_000 } else { 10_000 },
        duration_ms: 200_000,
        sessions: vec![MediaSessionInfo { id: source.clone(), label: source.clone(), playing }],
        active_session_id: Some(source.clone()),
        source_app: Some(source),
        updated_at: 1,
        ..MediaState::empty()
    }
}

fn player(pid: i32, name: &str, label: &str) -> AudioPlayer {
    let id = name.to_string();
    AudioPlayer {
        pid,
        names: vec![name.to_string()],
        label: label.to_string(),
        state: MediaState {
            available: true,
            audio_active: true,
            audio_peak: 0.4,
            playback_status: "playing",
            sessions: vec![MediaSessionInfo { id: id.clone(), label: label.to_string(), playing: true }],
            active_session_id: Some(id.clone()),
            source_app: Some(id),
            updated_at: 5,
            ..MediaState::empty()
        },
    }
}

fn soda_adapter(pid: Option<i32>, app_names: &[&str], source: &str) -> AdapterApp {
    AdapterApp { pid, app_names: app_names.iter().map(|name| name.to_string()).collect(), source: Some(source.to_string()) }
}

fn run(adapter: AdapterApp, title: Option<&str>, found: Option<AudioPlayer>, custom: &[CustomMediaPlayer]) -> MediaState {
    let mut builds = Vec::new();
    let state = choose(false, || adapter, custom, || found, |force| {
        builds.push(force);
        adapter_state(title, force)
    });
    assert!(builds.len() <= 1, "the adapter state is sampled once per tick: {builds:?}");
    state
}

fn assert_merged(state: &MediaState) {
    assert_eq!(state.title.as_deref(), Some("晴天"));
    assert_eq!(state.artist.as_deref(), Some("歌手"));
    assert!(state.thumbnail.is_some());
    assert_eq!(state.playback_status, "playing");
    assert!(state.audio_active);
    assert_eq!(state.audio_peak, 0.4);
    assert_eq!(state.position_ms, 12_000);
    assert_eq!(state.source_app.as_deref(), Some("com.soda.music"));
    assert_eq!(state.active_session_id.as_deref(), Some("com.soda.music"));
    assert!(state.sessions.iter().all(|session| session.playing && session.id == "com.soda.music"));
    assert_eq!(state.updated_at, 5);
}

#[test]
fn the_same_app_by_pid_keeps_the_adapter_track_and_plays() {
    let adapter = soda_adapter(Some(321), &[], "com.soda.music");
    let state = run(adapter, Some("晴天"), Some(player(321, "汽水音乐", "汽水音乐")), &[]);
    assert_merged(&state);
}

#[test]
fn the_same_app_by_bundle_path_name_keeps_the_adapter_track() {
    let adapter = soda_adapter(Some(1), &["汽水音乐"], "com.soda.music");
    let state = run(adapter, Some("晴天"), Some(player(321, "汽水音乐.app", "汽水音乐")), &[]);
    assert_merged(&state);
}

#[test]
fn the_same_app_by_player_label_keeps_the_adapter_track() {
    let adapter = soda_adapter(None, &[], "com.spotify.client");
    let state = run(adapter, Some("晴天"), Some(player(321, "Spotify", "Spotify")), &[]);
    assert_merged(&state);
    let custom = [CustomMediaPlayer { id: "mymusic".to_string(), label: "My Music".to_string() }];
    assert!(same_app(&soda_adapter(None, &[], "mymusic"), &player(9, "MyMusic", "My Music"), &custom));
    assert!(same_app(&soda_adapter(None, &[], "com.soda.music"), &player(9, "汽水音乐", "汽水音乐"), &custom));
    assert!(!same_app(&soda_adapter(None, &[], "com.unknown.player"), &player(9, "汽水音乐", "汽水音乐"), &custom));
}

#[test]
fn a_different_app_making_sound_wins_over_a_paused_adapter() {
    let adapter = soda_adapter(Some(100), &["Music"], "com.apple.Music");
    let state = run(adapter, Some("晴天"), Some(player(321, "汽水音乐", "汽水音乐")), &[]);
    assert_eq!(state.title, None);
    assert_eq!(state.source_app.as_deref(), Some("汽水音乐"));
    assert_eq!(state.playback_status, "playing");
}

#[test]
fn an_adapter_without_a_title_falls_back_to_the_sound_process() {
    let adapter = soda_adapter(Some(321), &[], "com.soda.music");
    let state = run(adapter, None, Some(player(321, "汽水音乐", "汽水音乐")), &[]);
    assert_eq!(state.title, None);
    assert_eq!(state.source_app.as_deref(), Some("汽水音乐"));
    let state = choose(true, || soda_adapter(Some(321), &[], "com.soda.music"), &[], || Some(player(321, "汽水音乐", "汽水音乐")), |force| adapter_state(None, force));
    assert_eq!(state.source_app.as_deref(), Some("汽水音乐"));
}

#[test]
fn a_playing_adapter_never_asks_for_the_sound_process() {
    let mut builds = Vec::new();
    let state = choose(true, || panic!("no adapter app lookup"), &[], || panic!("no fallback"), |force| {
        builds.push(force);
        adapter_state(Some("晴天"), true)
    });
    assert_eq!(builds, [false]);
    assert_eq!(state.source_app.as_deref(), Some("com.soda.music"));
    assert_eq!(state.playback_status, "playing");
}

#[test]
fn nothing_making_sound_keeps_the_paused_adapter() {
    let adapter = soda_adapter(Some(321), &[], "com.soda.music");
    let state = run(adapter, Some("晴天"), None, &[]);
    assert_eq!(state.playback_status, "paused");
    assert_eq!(state.title.as_deref(), Some("晴天"));
}

#[test]
fn merge_takes_only_the_playback_fields_from_the_player() {
    let merged = merge(adapter_state(Some("晴天"), true), player(1, "x", "x").state);
    assert_eq!(merged.duration_ms, 200_000);
    assert_eq!(merged.audio_peak, 0.4);
}
