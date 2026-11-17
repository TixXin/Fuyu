mod beside;
mod data_copy;
mod seed;

use std::sync::OnceLock;

pub(crate) use seed::before_start;

const ENV: [&str; 2] = ["FUYU_DEV_LANE", "FOCUSD_DEV_LANE"];
const SHARED_ENV: &str = "FUYU_DEV_SHARED_IDENTITY";
const CENTER_ENV: [&str; 2] = ["FUYU_DEV_LANE_CENTER", "FOCUSD_DEV_LANE_CENTER"];

fn env_var(names: [&str; 2]) -> Option<String> {
    first_set(names.map(|name| std::env::var(name).ok()))
}

fn first_set(values: [Option<String>; 2]) -> Option<String> {
    values.into_iter().flatten().next()
}

pub(crate) fn lane() -> Option<u32> {
    static LANE: OnceLock<Option<u32>> = OnceLock::new();
    *LANE.get_or_init(|| {
        let shared = std::env::var(SHARED_ENV).is_ok_and(|value| value == "1");
        let verifying = crate::notification_diagnostics::verification_identifier().is_some();
        chosen(cfg!(debug_assertions) && !cfg!(test), shared || verifying, env_var(ENV).as_deref())
    })
}

fn chosen(development: bool, real_identity: bool, lane: Option<&str>) -> Option<u32> {
    if !development || real_identity {
        return None;
    }
    Some(lane.and_then(|lane| lane.trim().parse().ok()).filter(|lane| (1..=999).contains(lane)).unwrap_or(1))
}

pub(crate) fn identifier(lane: u32) -> String {
    format!("com.tixxin.fuyu.lane-{lane}")
}

pub(crate) fn service(base: &str) -> String {
    service_in(lane(), base)
}

fn service_in(lane: Option<u32>, base: &str) -> String {
    match (lane, base.strip_prefix(crate::rename_migration::NEW_IDENTIFIER)) {
        (Some(lane), Some(rest)) if rest.starts_with('.') => format!("{}{rest}", identifier(lane)),
        _ => base.to_string(),
    }
}

pub(crate) fn port(saved: u16, preferred: u16) -> u16 {
    port_in(lane(), saved, preferred)
}

fn port_in(lane: Option<u32>, saved: u16, preferred: u16) -> u16 {
    match lane.and_then(|lane| u16::try_from(lane).ok()) {
        Some(lane) if saved == preferred => preferred.saturating_add(lane),
        _ => saved,
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn separate_webview_storage(lane: u32) {
    crate::macos::process_name::set_process_name(&format!("fuyu-lane-{lane}"));
}

fn centred_preview() -> bool {
    env_var(CENTER_ENV).is_some_and(|value| value == "1")
}

pub(crate) fn stage_x(monitor: (i32, i32, i32), window: (i32, i32), scale: f64) -> i32 {
    let (monitor_x, monitor_y, monitor_width) = monitor;
    let (window_width, window_height) = window;
    let centred = left_edge(false, monitor_x, monitor_width, window_width);
    let aside = lane().is_some()
        && !centred_preview()
        && beside::decide(beside::Rect { left: centred, top: monitor_y, width: window_width, height: window_height }, scale);
    left_edge(aside, monitor_x, monitor_width, window_width)
}

pub(crate) const BESIDE_LOOK_EVERY: std::time::Duration = beside::LOOK_EVERY;

pub(crate) fn watches_installed_island() -> bool {
    lane().is_some() && !centred_preview()
}

pub(crate) fn poll_installed_island(window: &tauri::WebviewWindow) {
    if watches_installed_island() {
        beside::poll(window);
    }
}

fn left_edge(beside: bool, monitor_x: i32, monitor_width: i32, window_width: i32) -> i32 {
    if beside {
        monitor_x + (monitor_width / 4 - window_width / 2).max(0)
    } else {
        monitor_x + (monitor_width - window_width) / 2
    }
}

pub(crate) fn refuse_in_preview(action: &str) -> Result<(), String> {
    match lane() {
        Some(_) => Err(format!("This is a development build; it does not {action}. The installed Fuyu does that.")),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::{chosen, first_set, identifier, left_edge, port_in, service_in, stage_x};

    #[test]
    fn the_new_variable_wins_and_the_old_name_still_counts() {
        assert_eq!(first_set([Some("7".into()), Some("3".into())]).as_deref(), Some("7"));
        assert_eq!(first_set([None, Some("3".into())]).as_deref(), Some("3"));
        assert_eq!(first_set([None, None]), None);
    }

    #[test]
    fn a_lane_keeps_off_the_installed_apps_ports() {
        assert_eq!(port_in(None, 47830, 47830), 47830);
        assert_eq!(port_in(Some(1), 47830, 47830), 47831);
        assert_eq!(port_in(Some(7), 39271, 39271), 39278);
        assert_eq!(port_in(Some(1), 51234, 47830), 51234);
        assert_eq!(port_in(Some(1), 47831, 47830), 47831);
    }

    #[test]
    fn a_development_build_is_lane_one_unless_told_otherwise() {
        assert_eq!(chosen(true, false, None), Some(1));
        assert_eq!(chosen(true, false, Some("7")), Some(7));
        assert_eq!(chosen(true, false, Some(" 999 ")), Some(999));
        for odd in ["0", "1000", "one", "1.5", ""] {
            assert_eq!(chosen(true, false, Some(odd)), Some(1), "{odd}");
        }
        assert_eq!(chosen(true, true, Some("7")), None);
        assert_eq!(chosen(false, false, Some("7")), None);
        assert_eq!(chosen(false, false, None), None);
    }

    #[test]
    fn the_installed_app_keeps_its_credential_names_and_a_lane_gets_its_own() {
        for name in ["com.tixxin.fuyu.calendar", "com.tixxin.fuyu.bark", "com.tixxin.fuyu.plan-usage", "com.tixxin.fuyu.qq-mail", "com.tixxin.fuyu.translation", "com.tixxin.fuyu.plugin.dev.focusd.tasks"] {
            assert_eq!(service_in(None, name), name);
        }
        assert_eq!(service_in(Some(1), "com.tixxin.fuyu.bark"), "com.tixxin.fuyu.lane-1.bark");
        assert_eq!(service_in(Some(12), "com.tixxin.fuyu.plugin.dev.focusd.tasks"), "com.tixxin.fuyu.lane-12.plugin.dev.focusd.tasks");
        assert_eq!(service_in(Some(1), "Claude Code-credentials"), "Claude Code-credentials");
        assert_eq!(service_in(Some(1), "com.tixxin.fuyuu.bark"), "com.tixxin.fuyuu.bark");
    }

    #[test]
    fn the_island_is_centred_on_its_monitor_outside_a_preview() {
        assert_eq!(stage_x((0, 0, 2560), (760, 460), 1.0), 900);
        assert_eq!(stage_x((-1920, 0, 1920), (760, 460), 1.0), -1920 + 580);
        assert_eq!(stage_x((0, 0, 2561), (760, 460), 1.0), 900, "the same rounding as before");
    }

    #[test]
    fn a_preview_sits_on_the_left_quarter_unless_centred() {
        assert_eq!(left_edge(true, 0, 2560, 760), 260);
        assert_eq!(left_edge(true, 0, 1000, 760), 0, "never off the monitor's left edge");
        assert_eq!(left_edge(false, 0, 2560, 760), 900);
    }

    #[test]
    fn each_lane_gets_its_own_identifier() {
        assert_eq!(identifier(2), "com.tixxin.fuyu.lane-2");
        assert_ne!(identifier(2), identifier(12));
    }
}
