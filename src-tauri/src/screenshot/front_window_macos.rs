use std::path::Path;

use crate::macos::{accessibility, apps};

pub(super) struct Front(i32);

pub(super) fn front() -> Option<Front> {
    let pid = apps::frontmost_pid()?;
    (u32::try_from(pid).ok() != Some(std::process::id())).then_some(Front(pid))
}

pub(super) fn describe(front: Front) -> Option<(String, String, Option<String>)> {
    let path = apps::path(front.0)?;
    let app = Path::new(&path).file_stem()?.to_string_lossy().into_owned();
    let window = accessibility::app_windows(front.0).into_iter().next();
    let title = window.as_ref().map(|(_, title)| title.clone()).unwrap_or_default();
    let url = window.and_then(|(window, _)| window.text("AXDocument"));
    Some((app, title, url))
}
