use super::{
    format::{bitrate, capture_buffers, even, file_name_in, fit, fps},
    pacing::{Pacer, Step, TICKS_PER_SECOND},
};

const MS: i64 = TICKS_PER_SECOND / 1000;
const START: i64 = 1_000_000 * MS;

fn pacer() -> Pacer<&'static str> {
    Pacer::new(10)
}

#[test]
fn the_first_frame_starts_the_video_at_zero() {
    let mut pacer = pacer();
    assert_eq!(pacer.next(START), Step::Wait(None));
    pacer.push("a", START);
    assert_eq!(pacer.next(START + 5 * MS), Step::Write("a", 0));
}

#[test]
fn a_static_screen_repeats_only_after_three_intervals() {
    let mut pacer = pacer();
    pacer.push("a", START);
    assert_eq!(pacer.next(START), Step::Write("a", 0));
    assert_eq!(pacer.next(START + 100 * MS), Step::Wait(Some(200 * MS)));
    assert_eq!(pacer.next(START + 300 * MS), Step::Repeat("a", 100 * MS));
    assert_eq!(pacer.next(START + 300 * MS), Step::Wait(Some(100 * MS)));
    assert_eq!(pacer.next(START + 400 * MS), Step::Repeat("a", 200 * MS));
}

#[test]
fn a_late_frame_keeps_its_own_time_instead_of_a_repeat() {
    let mut pacer = pacer();
    pacer.push("a", START);
    pacer.next(START);
    pacer.push("b", START + 175 * MS);
    assert_eq!(pacer.next(START + 280 * MS), Step::Write("b", 175 * MS));
    pacer.push("c", START + 200 * MS);
    assert_eq!(pacer.next(START + 280 * MS), Step::Write("c", 275 * MS));
}

#[test]
fn frames_faster_than_the_rate_wait_and_only_the_newest_is_kept() {
    let mut pacer = pacer();
    pacer.push("a", START);
    pacer.next(START);
    pacer.push("b", START + 30 * MS);
    assert_eq!(pacer.next(START + 30 * MS), Step::Wait(Some(70 * MS)));
    pacer.push("c", START + 60 * MS);
    assert_eq!(pacer.next(START + 100 * MS), Step::Write("c", 100 * MS));
}

#[test]
fn a_pause_is_cut_out_of_the_video() {
    let mut pacer = pacer();
    pacer.push("a", START);
    pacer.next(START);
    pacer.pause(START + 50 * MS);
    pacer.push("ignored", START + 60 * MS);
    assert_eq!(pacer.next(START + 5000 * MS), Step::Wait(None));
    pacer.resume(START + 2050 * MS);
    pacer.push("b", START + 2200 * MS);
    assert_eq!(pacer.next(START + 2200 * MS), Step::Write("b", 200 * MS));
}

#[test]
fn the_newest_frame_is_written_when_stopping() {
    let mut pacer = pacer();
    pacer.push("a", START);
    pacer.next(START);
    pacer.push("b", START + 20 * MS);
    assert_eq!(pacer.finish(), Some(("b", 20 * MS)));
    assert_eq!(pacer.duration(), 120 * MS);
}

#[test]
fn sizes_are_even_and_fit_hardware_encoders() {
    assert_eq!((even(101), even(1), even(0)), (100, 2, 2));
    assert_eq!(fit(1921, 1081), (1920, 1080));
    assert_eq!(fit(4096, 2160), (4096, 2160));
    assert_eq!(fit(5120, 2880), (4096, 2304));
    assert_eq!(fit(1440, 5120), (1152, 4096));
}

#[test]
fn rate_buffers_and_bitrate_follow_the_frame_rate() {
    assert_eq!((fps(None), fps(Some(0)), fps(Some(240))), (30, 1, 60));
    assert_eq!((capture_buffers(15), capture_buffers(30), capture_buffers(60)), (2, 2, 4));
    assert_eq!(bitrate(1920, 1080, 30, false), 6_220_800);
    assert_eq!(bitrate(1920, 1080, 30, true), 12_441_600);
    assert_eq!(bitrate(1920, 1080, 60, false), 9_331_200);
    assert_eq!(bitrate(100, 100, 30, false), 2_000_000);
}

#[test]
fn file_names_do_not_overwrite_earlier_recordings() {
    let folder = std::env::temp_dir().join(format!("fuyu-recording-names-{}", std::process::id()));
    std::fs::create_dir_all(&folder).unwrap();
    let now = chrono::Local::now();
    let first = file_name_in(&folder, now, "mp4");
    std::fs::write(&first, b"").unwrap();
    let second = file_name_in(&folder, now, "mp4");
    assert_ne!(first, second);
    assert!(second.to_string_lossy().ends_with("_2.mp4"));
    std::fs::remove_dir_all(&folder).unwrap();
}

#[test]
#[ignore = "records the real screen for three seconds"]
fn records_the_primary_screen_to_an_mp4() {
    let path = std::env::temp_dir().join(format!("fuyu-recording-{}.mp4", std::process::id()));
    let options = super::session::Options { x: 101, y: 51, width: 1601, height: 901, fps: 60, high_quality: false, system_audio: true, microphone: true, path: path.clone(), gif: None };
    let recording = super::session::Recording::start(options).unwrap();
    std::thread::sleep(std::time::Duration::from_secs(3));
    let summary = recording.stop().unwrap();
    println!("{summary:?}");
    assert!(summary.frames >= 1);
    assert!(summary.seconds > 2.5, "{summary:?}");
    assert!(std::fs::metadata(&path).unwrap().len() > 1000);
}

mod mixing {
    use super::super::mixer::{frames_at, ticks_at, Mixer, RATE};

    fn tone(frames: usize, value: f32) -> Vec<f32> {
        vec![value; frames * 2]
    }

    #[test]
    fn ticks_and_frames_convert_both_ways() {
        assert_eq!(frames_at(10_000_000), RATE);
        assert_eq!(ticks_at(RATE / 2), 5_000_000);
    }

    #[test]
    fn packets_a_little_off_are_joined_without_a_click() {
        let mut mixer = Mixer::new(1);
        mixer.push(0, 0, &tone(480, 0.5));
        mixer.push(0, 480 + 50, &tone(480, 0.5));
        let out = mixer.take(960);
        assert_eq!(out.len(), 1920);
        assert!(out.iter().all(|&sample| sample == 0.5));
    }

    #[test]
    fn a_real_gap_becomes_silence_and_an_overlap_is_dropped() {
        let mut mixer = Mixer::new(1);
        mixer.push(0, 0, &tone(480, 0.5));
        mixer.push(0, 1480, &tone(480, 0.25));
        let out = mixer.take(1960);
        assert_eq!(out[2 * 479], 0.5);
        assert_eq!(out[2 * 1000], 0.0);
        assert_eq!(out[2 * 1500], 0.25);
        mixer.push(0, 1000, &tone(500, 0.75));
        assert_eq!(mixer.take(1970)[0], 0.0);
    }

    #[test]
    fn two_sources_are_added_and_clipped() {
        let mut mixer = Mixer::new(2);
        mixer.push(0, 0, &tone(480, 0.25));
        mixer.push(1, 0, &tone(480, 0.5));
        assert_eq!(mixer.take(480)[0], 0.75);
        mixer.push(0, 480, &tone(480, 0.75));
        mixer.push(1, 480, &tone(480, 0.75));
        assert_eq!(mixer.take(960)[0], 1.0);
    }

    #[test]
    fn output_waits_for_the_slower_source_but_not_for_a_stalled_one() {
        let mut mixer = Mixer::new(2);
        mixer.push(0, 0, &tone(4800, 0.1));
        mixer.push(1, 0, &tone(960, 0.1));
        assert_eq!(mixer.ready(4800), Some(960));
        mixer.push(1, 960, &tone(960, 0.1));
        assert_eq!(mixer.ready(4800), Some(1920));
        assert_eq!(mixer.ready(12_000), Some(4800));
        assert_eq!(mixer.ready(RATE), Some(RATE - RATE / 5));
        assert_eq!(Mixer::new(1).ready(RATE), Some(RATE - RATE / 5));
    }

    #[test]
    fn audio_from_before_the_video_started_is_dropped() {
        let mut mixer = Mixer::new(1);
        mixer.push(0, -240, &tone(480, 0.5));
        let out = mixer.take(480);
        assert_eq!(out[0], 0.5);
        assert_eq!(out[2 * 240], 0.0);
    }
}

mod timer {
    use super::super::state::{Phase, State};

    #[test]
    fn the_timer_counts_only_while_not_paused() {
        let running = State::recording(1_000);
        let paused = running.paused(true, 4_000);
        assert!(paused.paused);
        assert_eq!(paused.elapsed_ms, 3_000);
        let again = paused.paused(false, 60_000);
        assert_eq!((again.paused, again.elapsed_ms, again.since_ms), (false, 3_000, 60_000));
        assert_eq!(again.paused(false, 70_000), again);
    }

    #[test]
    fn a_countdown_has_no_time_and_cannot_pause() {
        let counting = State::counting(3);
        assert_eq!((counting.phase, counting.countdown), (Phase::Countdown, 3));
        assert_eq!(counting.paused(true, 10), counting);
    }
}

mod gif_rate {
    use super::super::{gif::GifRate, pacing::TICKS_PER_SECOND};

    const MS: i64 = TICKS_PER_SECOND / 1000;

    #[test]
    fn a_thirty_frame_video_gives_every_other_frame_to_the_gif() {
        let mut rate = GifRate::new();
        let kept: Vec<i64> = (0..10).map(|n| n * 33 * MS).filter(|&stamp| rate.take(stamp)).collect();
        assert_eq!(kept, [0, 99 * MS, 165 * MS, 231 * MS, 297 * MS]);
    }

    #[test]
    fn a_frame_after_a_long_still_stretch_is_kept() {
        let mut rate = GifRate::new();
        assert!(rate.take(0));
        assert!(!rate.take(40 * MS));
        assert!(rate.take(2_000 * MS));
        assert!(!rate.take(2_010 * MS));
    }
}

#[test]
#[ignore = "records the real screen for three seconds"]
fn records_the_primary_screen_to_a_gif() {
    let folder = std::env::temp_dir();
    let video = folder.join(format!("fuyu-recording-gif-{}.mp4", std::process::id()));
    let gif = folder.join(format!("fuyu-recording-{}.gif", std::process::id()));
    let options = super::session::Options { x: 0, y: 0, width: 1920, height: 1080, fps: 30, high_quality: false, system_audio: false, microphone: false, path: video.clone(), gif: Some(gif.clone()) };
    let recording = super::session::Recording::start(options).unwrap();
    std::thread::sleep(std::time::Duration::from_secs(3));
    let summary = recording.stop().unwrap();
    println!("{summary:?}");
    assert_eq!(summary.path, gif.display().to_string());
    assert!(!video.exists());
    assert!(std::fs::metadata(&gif).unwrap().len() > 1000);
}
