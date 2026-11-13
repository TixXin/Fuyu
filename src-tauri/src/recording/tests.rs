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
    assert_eq!(bitrate(1920, 1080, 30), 6_220_800);
    assert_eq!(bitrate(1920, 1080, 60), 9_331_200);
    assert_eq!(bitrate(100, 100, 30), 2_000_000);
}

#[test]
fn file_names_do_not_overwrite_earlier_recordings() {
    let folder = std::env::temp_dir().join(format!("fuyu-recording-names-{}", std::process::id()));
    std::fs::create_dir_all(&folder).unwrap();
    let now = chrono::Local::now();
    let first = file_name_in(&folder, now);
    std::fs::write(&first, b"").unwrap();
    let second = file_name_in(&folder, now);
    assert_ne!(first, second);
    assert!(second.to_string_lossy().ends_with("_2.mp4"));
    std::fs::remove_dir_all(&folder).unwrap();
}

#[test]
#[ignore = "records the real screen for three seconds"]
fn records_the_primary_screen_to_an_mp4() {
    let path = std::env::temp_dir().join(format!("fuyu-recording-{}.mp4", std::process::id()));
    let options = super::session::Options { x: 101, y: 51, width: 1601, height: 901, fps: 60, path: path.clone() };
    let recording = super::session::Recording::start(options).unwrap();
    std::thread::sleep(std::time::Duration::from_secs(3));
    let summary = recording.stop().unwrap();
    println!("{summary:?}");
    assert!(summary.frames >= 1);
    assert!(summary.seconds > 2.5, "{summary:?}");
    assert!(std::fs::metadata(&path).unwrap().len() > 1000);
}
