use super::{track_key, Published, TimelineClock};

const T0: i64 = 1_800_000_000_000;

fn at(position_ms: i64, updated_ms: i64) -> Published {
    Published { position_ms, updated_ms: Some(updated_ms), rate: 1.0, duration_ms: 240_000 }
}

#[test]
fn a_playing_track_moves_on_from_what_the_player_published() {
    let mut clock = TimelineClock::default();
    assert_eq!(clock.sample("app", "a", at(10_000, T0), true, T0 + 2_500), 12_500);
    assert_eq!(clock.sample("app", "a", at(10_000, T0), true, T0 + 900_000), 240_000);
}

#[test]
fn an_unchanged_timeline_keeps_counting_from_the_clock_when_the_player_stamp_is_in_the_future() {
    let mut clock = TimelineClock::default();
    let skewed = at(30_000, T0 + 5_000);
    assert_eq!(clock.sample("app", "a", skewed, true, T0), 30_000);
    assert_eq!(clock.sample("app", "a", skewed, true, T0 + 1_500), 31_500);
    assert_eq!(clock.sample("app", "a", skewed, true, T0 + 3_000), 33_000);
}

#[test]
fn pausing_stops_at_the_estimate_instead_of_the_stale_published_position() {
    let mut clock = TimelineClock::default();
    let start = at(5_000, T0);
    assert_eq!(clock.sample("app", "a", start, true, T0 + 20_000), 25_000);
    assert_eq!(clock.sample("app", "a", start, false, T0 + 20_100), 25_000);
    assert_eq!(clock.sample("app", "a", start, false, T0 + 40_000), 25_000);
    assert_eq!(clock.sample("app", "a", start, true, T0 + 41_000), 25_000);
    assert_eq!(clock.sample("app", "a", start, true, T0 + 42_000), 26_000);
}

#[test]
fn a_pause_position_slightly_behind_the_estimate_is_not_taken() {
    let mut clock = TimelineClock::default();
    assert_eq!(clock.sample("app", "a", at(5_000, T0), true, T0 + 20_000), 25_000);
    assert_eq!(clock.sample("app", "a", at(24_200, T0 + 20_050), false, T0 + 20_100), 25_000);
    assert_eq!(clock.sample("app", "a", at(25_300, T0 + 20_200), false, T0 + 20_300), 25_300);
}

#[test]
fn a_republished_older_position_does_not_step_back_but_a_real_seek_does() {
    let mut clock = TimelineClock::default();
    assert_eq!(clock.sample("app", "a", at(60_000, T0), true, T0 + 1_000), 61_000);
    assert_eq!(clock.sample("app", "a", at(60_000, T0 + 1_500), true, T0 + 2_000), 62_000);
    assert_eq!(clock.sample("app", "a", at(10_000, T0 + 2_500), true, T0 + 3_000), 10_500);
    assert_eq!(clock.sample("app", "a", at(90_000, T0 + 3_500), true, T0 + 4_000), 90_500);
}

#[test]
fn seeking_from_the_island_takes_the_target_and_then_the_next_published_position() {
    let mut clock = TimelineClock::default();
    assert_eq!(clock.sample("app", "a", at(60_000, T0), true, T0), 60_000);
    clock.seeked(Some("app"), 59_000, T0 + 100);
    assert_eq!(clock.sample("app", "a", at(60_000, T0), true, T0 + 600), 59_500);
    assert_eq!(clock.sample("app", "a", at(58_900, T0 + 650), true, T0 + 700), 58_950);
    assert_eq!(clock.sample("app", "a", at(58_000, T0 + 750), true, T0 + 800), 58_950 + 100);
}

#[test]
fn seeking_without_a_session_uses_the_last_sampled_one() {
    let mut clock = TimelineClock::default();
    clock.sample("app", "a", at(60_000, T0), false, T0);
    clock.seeked(None, 120_000, T0 + 10);
    assert_eq!(clock.sample("app", "a", at(60_000, T0), false, T0 + 20), 120_000);
}

#[test]
fn a_new_track_starts_from_its_own_timeline() {
    let mut clock = TimelineClock::default();
    assert_eq!(clock.sample("app", "a", at(200_000, T0), true, T0), 200_000);
    assert_eq!(clock.sample("app", "b", at(500, T0 + 100), true, T0 + 200), 600);
    assert_eq!(clock.sample("other", "c", at(1_000, T0), false, T0 + 300), 1_000);
    assert_eq!(clock.sample("app", "b", at(500, T0 + 100), true, T0 + 1_200), 1_600);
}

#[test]
fn faster_playback_moves_the_estimate_faster_and_a_bad_rate_counts_as_normal() {
    let mut clock = TimelineClock::default();
    let fast = Published { rate: 2.0, ..at(0, T0) };
    assert_eq!(clock.sample("app", "a", fast, true, T0 + 1_000), 2_000);
    assert_eq!(clock.sample("app", "a", fast, true, T0 + 2_000), 4_000);
    let broken = Published { rate: 0.0, ..at(0, T0) };
    assert_eq!(clock.sample("app", "z", broken, true, T0 + 1_000), 1_000);
}

#[test]
fn track_keys_tell_songs_apart() {
    assert_ne!(track_key(Some("A"), Some("X"), None, 200_000), track_key(Some("B"), Some("X"), None, 200_000));
    assert_eq!(track_key(Some("A"), Some("X"), None, 200_000), track_key(Some("A"), Some("X"), None, 200_900));
}
