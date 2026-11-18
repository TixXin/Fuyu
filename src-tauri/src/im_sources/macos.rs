use std::sync::Arc;

use super::{
    now_ms,
    specs::{ImSourceSpec, SOURCES},
    state::BadgeReading,
    ImSourcesService,
};
use crate::{
    macos::{
        accessibility, apps,
        dock_badges::{self, Badge, DockSource},
    },
    messages_plugin::{self, SourceSwitch},
};

fn to_badge_reading(badge: Badge) -> BadgeReading {
    match badge {
        Badge::NotAllowed => BadgeReading::NotAllowed,
        Badge::NotInDock => BadgeReading::NotInDock,
        Badge::Label(label) => BadgeReading::Label(label),
    }
}

pub(super) fn register_sources(service: &Arc<ImSourcesService>) {
    for (index, spec) in SOURCES.iter().enumerate() {
        let badged = Arc::clone(service);
        let activated = Arc::clone(service);
        dock_badges::subscribe(DockSource {
            source: spec.id,
            bundle_ids: spec.macos_bundle_ids,
            on_badge: Arc::new(move |reading| {
                badged.on_badge(index, to_badge_reading(reading), now_ms());
            }),
            on_activate: Arc::new(move || {
                activated.on_foreground(index, now_ms());
            }),
        });

        let switched = Arc::clone(service);
        let checked = Arc::clone(service);
        let switch = SourceSwitch::new(
            spec.id,
            move |enabled| {
                switched.on_set_enabled(index, enabled);
                dock_badges::set_enabled(spec.id, enabled);
            },
            move || checked.is_enabled(index) && dock_badges::is_source_running(spec.id),
        );
        messages_plugin::register(spec.id, switch);
    }
}

pub(super) fn detect_installed_all() -> [bool; SOURCES.len()] {
    std::array::from_fn(|index| {
        SOURCES[index]
            .macos_bundle_ids
            .iter()
            .any(|bundle_id| apps::path_for_bundle_id(bundle_id).is_some())
    })
}

pub(super) fn open_source(spec: &ImSourceSpec) -> Result<(), String> {
    let installed = spec
        .macos_bundle_ids
        .iter()
        .any(|bundle_id| apps::path_for_bundle_id(bundle_id).is_some());
    if !installed {
        return Err(format!(
            "{} is not installed on this Mac.",
            spec.display_name
        ));
    }
    dock_badges::open_candidates(spec.macos_bundle_ids)
}

pub(super) fn request_notification_access() -> Result<String, String> {
    if accessibility::is_trusted() {
        return Ok("allowed".to_string());
    }
    dock_badges::open_accessibility_settings()?;
    Ok("unspecified".to_string())
}

pub(super) fn open_notification_settings() -> Result<(), String> {
    dock_badges::open_accessibility_settings()
}
