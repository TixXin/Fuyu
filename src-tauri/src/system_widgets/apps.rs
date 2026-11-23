use std::{io::Cursor, path::Path};

use base64::{engine::general_purpose, Engine as _};
use image::{ImageFormat, RgbaImage};
use serde::Serialize;

use crate::platform;

#[cfg(not(target_os = "macos"))]
const APP_EXTENSIONS: &[&str] = &["exe", "lnk"];
#[cfg(target_os = "macos")]
const APP_EXTENSIONS: &[&str] = &["app"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickAppInfo {
    path: String,
    name: String,
    icon: Option<String>,
}

fn extension(path: &Path) -> Option<String> {
    path.extension().and_then(|extension| extension.to_str()).map(str::to_ascii_lowercase)
}

pub(crate) fn is_app(path: &str) -> bool {
    let path = Path::new(path);
    let Some(extension) = extension(path) else {
        return false;
    };
    if !path.is_absolute() || !APP_EXTENSIONS.contains(&extension.as_str()) {
        return false;
    }
    if extension == "app" {
        path.is_dir()
    } else {
        path.is_file()
    }
}

fn name_of(path: &Path) -> String {
    path.file_stem().map(|stem| stem.to_string_lossy().into_owned()).unwrap_or_default()
}

#[cfg(windows)]
fn icon_pixels(path: &str) -> Option<platform::icon::IconPixels> {
    if extension(Path::new(path)).as_deref() == Some("exe") {
        platform::icon::exe_icon(path)
    } else {
        platform::icon::shell_icon(path)
    }
}

#[cfg(not(windows))]
fn icon_pixels(path: &str) -> Option<platform::icon::IconPixels> {
    platform::icon::exe_icon(path)
}

fn icon_url(path: &str) -> Option<String> {
    let icon = icon_pixels(path)?;
    let image = RgbaImage::from_raw(icon.width, icon.height, icon.rgba)?;
    let mut png = Cursor::new(Vec::new());
    image.write_to(&mut png, ImageFormat::Png).ok()?;
    Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(png.into_inner())))
}

pub(crate) fn info(path: &str) -> Option<QuickAppInfo> {
    is_app(path).then(|| QuickAppInfo {
        path: path.to_owned(),
        name: name_of(Path::new(path)),
        icon: icon_url(path),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_existing_absolute_programs_are_apps() {
        assert!(!is_app(""));
        assert!(!is_app("calc.exe"));
        assert!(!is_app("Calculator.app"));
        assert!(!is_app("/bin/sh"));
        assert!(!is_app(r"C:\does\not\exist.exe"));
        assert!(!is_app("/Applications/Does Not Exist.app"));
        assert!(info("/etc/hosts").is_none());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn a_mac_app_has_its_bundle_name_and_icon() {
        let found = info("/System/Applications/Calculator.app").expect("Calculator is an app");
        assert_eq!(found.name, "Calculator");
        assert!(found.icon.is_some_and(|icon| icon.starts_with("data:image/png;base64,")));
    }

    #[cfg(windows)]
    #[test]
    fn a_windows_program_has_its_file_name_and_icon() {
        let explorer = std::env::var("WINDIR").map(|dir| format!(r"{dir}\explorer.exe")).unwrap_or_default();
        let found = info(&explorer).expect("explorer.exe is an app");
        assert_eq!(found.name.to_lowercase(), "explorer");
        assert!(found.icon.is_some());
    }
}
