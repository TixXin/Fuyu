use super::*;

#[test]
fn burst_coalescing_keeps_strongest_signal_in_window() {
    let playback_a = BurstSignal::Playback(Some("apple".into()), 100);
    let playback_b = BurstSignal::Playback(Some("apple".into()), 120);
    let track = BurstSignal::Track(Some("apple".into()), 140);

    assert_eq!(
        merge_burst(playback_a.clone(), playback_b.clone()),
        playback_b
    );
    assert_eq!(merge_burst(playback_a, track.clone()), track);
    assert_eq!(merge_burst(track.clone(), playback_b), track);
    assert_eq!(merge_burst(track, BurstSignal::Sessions), BurstSignal::Sessions);
    assert_eq!(
        merge_burst(
            BurstSignal::Sessions,
            BurstSignal::Playback(Some("apple".into()), 160)
        ),
        BurstSignal::Sessions
    );
}

#[test]
fn timeline_gate_throttles_linear_progress_but_emits_seeks_immediately() {
    let mut gate = TimelineGate::default();
    let sample = |position_ms, duration_ms, at_ms| TimelineSample {
        position_ms,
        duration_ms,
        at_ms,
    };

    assert!(gate.should_emit(Some("apple"), Some(sample(10_000, 200_000, 1_000)), 1_000));
    assert!(!gate.should_emit(Some("apple"), Some(sample(10_500, 200_000, 1_500)), 1_500));
    assert!(!gate.should_emit(Some("apple"), Some(sample(11_000, 200_000, 2_000)), 2_000));

    assert!(gate.should_emit(Some("apple"), Some(sample(95_000, 200_000, 2_300)), 2_300));
    assert!(!gate.should_emit(Some("apple"), Some(sample(95_500, 200_000, 2_800)), 2_800));
    assert!(gate.should_emit(
        Some("apple"),
        Some(sample(100_000, 200_000, 2_300 + TIMELINE_MIN_EMIT_MS)),
        2_300 + TIMELINE_MIN_EMIT_MS
    ));
}

#[test]
fn timeline_gate_caps_session_entries() {
    let mut gate = TimelineGate::default();
    for index in 0..(MAX_TIMELINE_SESSIONS + 6) {
        let now = 1_000 + index as i64;
        assert!(gate.should_emit(
            Some(&format!("session-{index:02}")),
            Some(TimelineSample {
                position_ms: 0,
                duration_ms: 100_000,
                at_ms: now,
            }),
            now,
        ));
    }
    assert_eq!(gate.entries.len(), MAX_TIMELINE_SESSIONS);
}

#[test]
fn metadata_cache_invalidates_on_epoch_change_and_retries_missing_cover_sooner() {
    let mut cache = MetadataCache::default();
    cache.put(Some("apple"), 1, 1_000, true, false, "title-without-cover");

    assert_eq!(cache.get(Some("apple"), 1, true, 1_500), Some("title-without-cover"));
    assert_eq!(
        cache.get(Some("apple"), 1, true, 1_000 + MISSING_COVER_RETRY_MS),
        None
    );

    cache.put(Some("apple"), 1, 3_000, true, true, "title-with-cover");
    assert_eq!(
        cache.get(Some("apple"), 1, true, 3_000 + MISSING_COVER_RETRY_MS + 500),
        Some("title-with-cover")
    );
    assert_eq!(cache.get(Some("apple"), 2, true, 3_100), None);
    assert_eq!(cache.get(Some("other"), 1, true, 3_100), None);
    assert_eq!(cache.get(Some("apple"), 1, false, 3_100), None);
}

#[test]
fn fallback_cache_skips_scans_during_smtc_playback_and_respects_ttl() {
    let mut cache: FallbackCache<(String, bool), usize> = FallbackCache::default();
    let mut scans = 0;

    let result = cache.resolve(
        FallbackQuery {
            smtc_playing: true,
            target_needs_fallback: false,
            audio_active: true,
            config_key: 0,
            now_ms: 1_000,
        },
        |(_, playing)| *playing,
        || {
            scans += 1;
            vec![("feiniu.exe".into(), true)]
        },
    );
    assert!(result.is_empty());
    assert_eq!(scans, 0);

    let active = cache.resolve(
        FallbackQuery {
            smtc_playing: false,
            target_needs_fallback: false,
            audio_active: true,
            config_key: 0,
            now_ms: 2_000,
        },
        |(_, playing)| *playing,
        || {
            scans += 1;
            vec![("feiniu.exe".into(), true)]
        },
    );
    assert_eq!(active.len(), 1);
    assert_eq!(scans, 1);

    let cached = cache.resolve(
        FallbackQuery {
            smtc_playing: false,
            target_needs_fallback: false,
            audio_active: true,
            config_key: 0,
            now_ms: 2_500,
        },
        |(_, playing)| *playing,
        || {
            scans += 1;
            Vec::new()
        },
    );
    assert_eq!(cached.len(), 1);
    assert_eq!(scans, 1);

    let refreshed_on_config_change = cache.resolve(
        FallbackQuery {
            smtc_playing: false,
            target_needs_fallback: false,
            audio_active: true,
            config_key: 1,
            now_ms: 2_600,
        },
        |(_, playing)| *playing,
        || {
            scans += 1;
            vec![("custom.exe".into(), false)]
        },
    );
    assert_eq!(refreshed_on_config_change[0].0, "custom.exe");
    assert_eq!(scans, 2);
}
