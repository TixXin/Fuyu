use std::path::{Path, PathBuf};

use image::{ImageBuffer, ImageFormat, ImageReader, Rgb};

use super::{assemble, color_hex, fit_name, thumbnail};
use crate::win32::wallpaper::{DesktopWallpapers, MonitorWallpaper};

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-wallpaper-test-{}-{name}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn write_png(path: &Path, width: u32, height: u32) {
    ImageBuffer::from_pixel(width, height, Rgb([200u8, 40, 90])).save_with_format(path, ImageFormat::Png).unwrap();
}

fn monitor(path: &str, left: i32) -> MonitorWallpaper {
    MonitorWallpaper { path: path.into(), left, top: 0, right: left + 1920, bottom: 1080 }
}

fn decoded_size(url: &str) -> (u32, u32) {
    use base64::{engine::general_purpose, Engine};
    let bytes = general_purpose::STANDARD.decode(url.trim_start_matches("data:image/jpeg;base64,")).unwrap();
    let image = ImageReader::new(std::io::Cursor::new(bytes)).with_guessed_format().unwrap().decode().unwrap();
    (image.width(), image.height())
}

#[test]
fn positions_and_colors_follow_the_shell_values() {
    assert_eq!([0, 1, 2, 3, 4, 5].map(fit_name), ["center", "tile", "stretch", "fit", "fill", "span"]);
    assert_eq!(fit_name(99), "fill");
    assert_eq!(color_hex(0x00332211), "#112233");
}

#[test]
fn large_wallpapers_shrink_to_the_long_side_and_small_ones_keep_their_size() {
    let dir = scratch("sizes");
    let wide = dir.join("wide.png");
    let small = dir.join("small.png");
    write_png(&wide, 3840, 1600);
    write_png(&small, 400, 300);
    assert_eq!(decoded_size(&thumbnail::encode(&wide).unwrap()), (thumbnail::MAX_SIDE, 400));
    assert_eq!(decoded_size(&thumbnail::encode(&small).unwrap()), (400, 300));
    assert!(thumbnail::encode(&dir.join("missing.png")).is_none());
}

#[test]
fn each_monitor_gets_its_own_image_and_a_broken_file_falls_back_to_the_transcoded_copy() {
    let dir = scratch("monitors");
    let left = dir.join("left.png");
    let transcoded = dir.join("TranscodedWallpaper");
    write_png(&left, 64, 32);
    write_png(&transcoded, 32, 64);
    let broken = dir.join("broken.heic");
    std::fs::write(&broken, b"not an image").unwrap();
    let desktop = DesktopWallpapers {
        monitors: vec![monitor(left.to_str().unwrap(), 0), monitor(broken.to_str().unwrap(), 1920), monitor("", 3840)],
        position: 4,
        background: 0,
    };
    let wallpapers = assemble(desktop, Some(transcoded));
    let [first, second, third] = &wallpapers.monitors[..] else { panic!("three monitors") };
    assert_eq!((first.x, first.width, second.x, third.x), (0, 1920, 1920, 3840));
    assert_eq!(decoded_size(first.image.as_deref().unwrap()), (64, 32));
    assert_eq!(decoded_size(second.image.as_deref().unwrap()), (32, 64));
    assert_eq!(third.image, None, "solid colour background");
    assert_eq!((wallpapers.fit, wallpapers.color.as_str()), ("fill", "#000000"));
}

#[test]
fn a_solid_colour_desktop_does_not_borrow_the_transcoded_copy() {
    let dir = scratch("solid");
    let transcoded = dir.join("TranscodedWallpaper");
    write_png(&transcoded, 16, 16);
    let desktop = DesktopWallpapers { monitors: vec![monitor("", 0)], position: 4, background: 0x00ff8000 };
    let wallpapers = assemble(desktop, Some(transcoded));
    assert_eq!(wallpapers.monitors[0].image, None);
    assert_eq!(wallpapers.color, "#0080ff");
}

#[test]
#[ignore = "needs an interactive desktop with a picture wallpaper"]
fn the_real_desktop_wallpaper_turns_into_a_small_jpeg() {
    let desktop = std::thread::spawn(crate::win32::wallpaper::desktop_wallpapers).join().unwrap().unwrap();
    let wallpapers = assemble(desktop, super::transcoded_wallpaper());
    let url = wallpapers.monitors.iter().find_map(|monitor| monitor.image.clone()).unwrap();
    let (width, height) = decoded_size(&url);
    assert_eq!(width.max(height), thumbnail::MAX_SIDE);
    assert!(url.len() < 400_000, "{} bytes", url.len());
}
