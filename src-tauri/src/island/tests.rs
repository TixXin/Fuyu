use tauri::PhysicalPosition;

use super::geometry::*;
use super::state::*;

fn state(mode: IslandMode, scale: f64, expanded_height: f64) -> IslandWindowState {
    IslandWindowState {
        mode,
        collapsed_scale: scale,
        expanded_scale: scale,
        expanded_height,
        ..IslandWindowState::default()
    }
}

#[test]
fn top_docked_taskbar_pushes_island_below_the_work_area() {
    assert_eq!(work_area_top_inset(0, 48), 48);
    assert_eq!(work_area_top_inset(0, 0), 0);
    assert_eq!(work_area_top_inset(-1080, -1080), 0);
    assert_eq!(work_area_top_inset(0, -10), 0);
}

#[test]
fn custom_position_survives_tuck_and_reveal() {
    let mut custom = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    custom.custom_position = Some(IslandPosition::at(420, 180));

    assert_eq!(resolve_stage_position(custom, 100, 12, -48), (420, 180));

    custom.is_tucked = true;
    assert_eq!(resolve_stage_position(custom, 100, 12, -48), (420, -48));

    custom.is_tucked = false;
    assert_eq!(resolve_stage_position(custom, 100, 12, -48), (420, 180));
}

#[test]
fn a_dragged_island_slides_out_of_its_tuck_at_the_top_edge() {
    let mut custom = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    custom.custom_position = Some(IslandPosition::at(420, 180));
    custom.out_at_top = true;
    assert_eq!(shown_custom_position(custom, 12), Some(IslandPosition::at(420, 12)));
    custom.is_tucked = true;
    assert_eq!(shown_custom_position(custom, 12), Some(IslandPosition::at(420, 180)));
    custom.is_tucked = false;
    custom.out_at_top = false;
    assert_eq!(shown_custom_position(custom, 12), Some(IslandPosition::at(420, 180)));

    let (collapsed, expanded) = (IslandMode::Collapsed, IslandMode::Expanded);
    assert!(out_at_top_after(false, true, false, false, collapsed));
    assert!(out_at_top_after(true, false, false, false, expanded));
    assert!(out_at_top_after(true, false, true, false, expanded));
    assert!(!out_at_top_after(true, false, true, false, collapsed));
    assert!(!out_at_top_after(true, false, false, true, collapsed));
    assert!(!out_at_top_after(false, false, true, false, collapsed));
}

#[test]
fn notch_has_flat_top_and_rounded_bottom_at_all_scales() {
    for scale in [0.75, DEFAULT_COLLAPSED_SCALE, 1.0, 1.4, 2.1] {
        for mode in [IslandMode::Collapsed, IslandMode::Expanded] {
            let (width, height) =
                mode.base_size(COLLAPSED_ISLAND_WIDTH, EXPANDED_ISLAND_WIDTH, DEFAULT_EXPANDED_ISLAND_HEIGHT);
            let width = width * scale;
            let height = height * scale;
            let radius = mode.corner_radius() * scale;
            let contains = |x, y| point_in_notch(x, y, 80.0, 0.0, width, height, radius, 0.0, CornerShape::Round);

            assert!(contains(80.0, 0.0));
            assert!(contains(80.0 + width, 0.0));
            assert!(contains(80.0 + width / 2.0, height));
            assert!(!contains(80.0, height));
            assert!(!contains(80.0 + width, height));
            assert!(!contains(79.0, 0.0));
            assert!(!contains(80.0 + width / 2.0, height + 1.0));
        }
    }
}

#[test]
fn default_notch_stays_at_top_when_expanding() {
    for mode in [IslandMode::Collapsed, IslandMode::Expanded] {
        let state = state(mode, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
        assert_eq!(state.margin_y, 0.0);
        assert_eq!(resolve_stage_position(state, 550, 0, -28), (550, 0));
    }
}

#[test]
fn compact_messages_and_mail_reader_keep_the_correct_cursor_boundary() {
    for height in [MIN_EXPANDED_ISLAND_HEIGHT, 244.0, 438.0, 450.0] {
        for scale in [0.75, 1.0, 1.4] {
            let (width, panel_height) =
                IslandMode::Expanded.base_size(COLLAPSED_ISLAND_WIDTH, EXPANDED_ISLAND_WIDTH, height);
            let contains = |y| {
                point_in_notch(
                    width * scale / 2.0,
                    y,
                    0.0,
                    0.0,
                    width * scale,
                    panel_height * scale,
                    EXPANDED_RADIUS * scale,
                    0.0,
                    CornerShape::Round,
                )
            };
            assert!(contains(panel_height * scale));
            assert!(!contains(panel_height * scale + 1.0));
            assert_eq!(
                IslandMode::Collapsed
                    .base_size(COLLAPSED_ISLAND_WIDTH, EXPANDED_ISLAND_WIDTH, height)
                    .1,
                COLLAPSED_ISLAND_HEIGHT
            );
        }
        let mut positioned = state(IslandMode::Expanded, 1.0, height);
        positioned.custom_position = Some(IslandPosition::at(420, 180));
        assert_eq!(resolve_stage_position(positioned, 100, 12, -48), (420, 180));
        positioned.is_tucked = true;
        assert_eq!(resolve_stage_position(positioned, 100, 12, -48), (420, -48));
    }
}

#[test]
fn detached_island_rounds_top_corners() {
    for mode in [IslandMode::Collapsed, IslandMode::Expanded] {
        let mut detached = state(mode, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
        assert_eq!(detached.top_corner_radius(), 0.0);
        detached.attached_edge = None;
        assert_eq!(detached.top_corner_radius(), detached.bottom_corner_radius());
        let (width, height) =
            mode.base_size(COLLAPSED_ISLAND_WIDTH, EXPANDED_ISLAND_WIDTH, DEFAULT_EXPANDED_ISLAND_HEIGHT);
        let contains = |x, y| {
            point_in_notch(
                x,
                y,
                80.0,
                0.0,
                width,
                height,
                mode.corner_radius(),
                detached.top_corner_radius(),
                CornerShape::Round,
            )
        };
        assert!(!contains(80.0, 0.0));
        assert!(!contains(80.0 + width, 0.0));
        assert!(contains(80.0 + width / 2.0, 0.0));
        assert!(!contains(79.0, 0.0));
        detached.attached_edge = Some(Edge::Top);
        assert_eq!(detached.top_corner_radius(), 0.0);
    }
}

#[test]
fn docked_island_does_not_capture_cursor_outside_its_sides() {
    for scale in [0.75, DEFAULT_COLLAPSED_SCALE, 1.0, 1.4, 2.1] {
        let width = COLLAPSED_ISLAND_WIDTH * scale;
        let contains = |x, y| {
            point_in_notch(
                x,
                y,
                80.0,
                0.0,
                width,
                COLLAPSED_ISLAND_HEIGHT * scale,
                COLLAPSED_RADIUS * scale,
                0.0,
                CornerShape::Round,
            )
        };
        assert!(contains(80.0, 0.0));
        assert!(contains(80.0 + width, 0.0));
        for y in [0.0, 3.0 * scale, 6.0 * scale] {
            assert!(!contains(79.0, y));
            assert!(!contains(81.0 + width, y));
        }
    }
}

#[test]
fn tuck_and_reveal_move_monotonically_between_physical_positions() {
    for (start, target) in [
        (
            PhysicalPosition::new(665, 0),
            PhysicalPosition::new(665, -32),
        ),
        (
            PhysicalPosition::new(-900, -32),
            PhysicalPosition::new(-900, 270),
        ),
    ] {
        assert_eq!(interpolate_stage_position(start, target, 0.0), start);
        assert_eq!(interpolate_stage_position(start, target, 1.0), target);
        let middle = interpolate_stage_position(start, target, 0.3);
        assert_ne!(middle, start);
        assert_ne!(middle, target);
        let mut last = start;
        for frame in 1..=40 {
            let current = interpolate_stage_position(start, target, frame as f64 / 40.0);
            assert_eq!(current.x, start.x);
            if target.y < start.y {
                assert!(current.y <= last.y && current.y >= target.y);
            } else {
                assert!(current.y >= last.y && current.y <= target.y);
            }
            last = current;
        }
    }
}

#[test]
fn corner_radius_setting_scales_every_hit_test_radius() {
    let mut expanded = state(IslandMode::Expanded, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    let mut collapsed = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    expanded.attached_edge = None;
    collapsed.attached_edge = None;
    assert_eq!(expanded.bottom_corner_radius(), EXPANDED_RADIUS);
    assert_eq!(collapsed.bottom_corner_radius(), COLLAPSED_RADIUS);
    assert_eq!(expanded.top_corner_radius(), EXPANDED_RADIUS);
    assert_eq!(collapsed.top_corner_radius(), COLLAPSED_RADIUS);

    expanded.corner_radius = 20.0;
    collapsed.corner_radius = 20.0;
    assert_eq!(expanded.bottom_corner_radius(), 20.0);
    assert!((collapsed.bottom_corner_radius() - 22.0 * 20.0 / 30.0).abs() < 1e-9);
    assert_eq!(expanded.top_corner_radius(), 20.0);
    assert!((collapsed.top_corner_radius() - 22.0 * 20.0 / 30.0).abs() < 1e-9);
}

#[test]
fn squircle_corners_take_the_area_css_draws_beyond_a_circle() {
    let r = 30.0;
    let along_axis = 1.1 * r * std::f64::consts::FRAC_1_SQRT_2;
    let (x, y) = (r - along_axis, 60.0 - r + along_axis);
    let contains = |shape| point_in_notch(x, y, 0.0, 0.0, 100.0, 60.0, r, 0.0, shape);
    assert!(!contains(CornerShape::Round));
    assert!(contains(CornerShape::Squircle));
    for shape in [CornerShape::Round, CornerShape::Squircle] {
        assert!(!point_in_notch(0.5, 59.5, 0.0, 0.0, 100.0, 60.0, r, 0.0, shape));
        assert!(point_in_notch(50.0, 59.5, 0.0, 0.0, 100.0, 60.0, r, 0.0, shape));
    }
    assert_eq!(CornerShape::from_value("squircle"), Some(CornerShape::Squircle));
    assert_eq!(CornerShape::from_value("round"), Some(CornerShape::Round));
    assert_eq!(CornerShape::from_value("bevel"), None);
}

#[test]
fn an_update_heading_where_the_slide_ends_lets_it_finish() {
    let running = Some((7, (900, 12)));
    assert!(continues_slide(running, 7, (900, 12), false));
    assert!(!continues_slide(running, 7, (900, -24), false));
    assert!(!continues_slide(running, 7, (900, 12), true));
    assert!(!continues_slide(running, 8, (900, 12), false));
    assert!(!continues_slide(None, 7, (900, 12), false));
}

#[cfg(windows)]
#[test]
fn the_island_follows_only_when_asked_and_only_while_collapsed() {
    use super::follow::may_move;
    use super::geometry::contains;
    assert_eq!(MonitorFollow::from_value("cursor"), Some(MonitorFollow::Cursor));
    assert_eq!(MonitorFollow::from_value("foreground"), Some(MonitorFollow::Foreground));
    assert_eq!(MonitorFollow::from_value("primary"), Some(MonitorFollow::Primary));
    assert_eq!(MonitorFollow::from_value("all"), None);
    assert_eq!(IslandWindowState::default().monitor_follow, MonitorFollow::Primary);

    let left = (-1920, 0, 1920, 1080);
    assert!(contains(left, (-1, 0)) && contains(left, (-1920, 1079)));
    assert!(!contains(left, (0, 0)) && !contains(left, (-100, 1080)));

    let mut collapsed = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    assert!(may_move(collapsed));
    collapsed.is_tucked = true;
    assert!(may_move(collapsed), "a tucked island follows too");
    collapsed.is_dragging = true;
    assert!(!may_move(collapsed));
    assert!(!may_move(state(IslandMode::Expanded, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT)), "an open panel stays under the pointer");
}

#[test]
fn banner_rect_takes_its_own_area_only() {
    use super::banner_hit::{banner_rect, set_island_banner_rect, BannerRect};

    let rect = BannerRect { x: 250.0, y: 42.0, width: 320.0, height: 72.0 };
    assert!(rect.contains(250.0, 42.0));
    assert!(rect.contains(410.0, 80.0));
    assert!(rect.contains(570.0, 114.0));
    assert!(!rect.contains(249.0, 80.0));
    assert!(!rect.contains(410.0, 115.0));

    set_island_banner_rect(Some(rect));
    assert_eq!(banner_rect(), Some(rect));
    set_island_banner_rect(Some(BannerRect { width: 0.0, ..rect }));
    assert_eq!(banner_rect(), None);
    set_island_banner_rect(Some(BannerRect { x: f64::NAN, ..rect }));
    assert_eq!(banner_rect(), None);
    set_island_banner_rect(Some(rect));
    set_island_banner_rect(None);
    assert_eq!(banner_rect(), None);
}

#[test]
fn popup_width_narrows_the_expanded_hit_area() {
    let (full, _) = IslandMode::Expanded.base_size(COLLAPSED_ISLAND_WIDTH, EXPANDED_ISLAND_WIDTH, 120.0);
    let (popup, height) = IslandMode::Expanded.base_size(COLLAPSED_ISLAND_WIDTH, 400.0, 120.0);
    assert_eq!((full, popup, height), (EXPANDED_ISLAND_WIDTH, 400.0, 120.0));
    let left = (STAGE_WINDOW_WIDTH - popup) / 2.0;
    let contains = |x: f64, width: f64| {
        point_in_notch(x, 40.0, (STAGE_WINDOW_WIDTH - width) / 2.0, 0.0, width, height, EXPANDED_RADIUS, 0.0, CornerShape::Round)
    };
    assert!(contains(left + 1.0, popup));
    assert!(!contains(left - 1.0, popup));
    assert!(contains(left - 1.0, full));
}

#[test]
fn a_wide_plugin_page_fits_the_island_window_at_any_scale() {
    assert_eq!(max_expanded_width(1.0), 792.0);
    assert_eq!(max_expanded_width(0.91), 872.0);
    assert_eq!(max_expanded_width(1.4), 560.0);
    for scale in [0.91, 1.0, 1.15, 1.4] {
        let side_room = (STAGE_WINDOW_WIDTH - max_expanded_width(scale) * scale) / 2.0;
        assert!(side_room >= 12.0 * scale, "scale {scale}: {side_room}");
    }
}

#[test]
fn stored_position_without_an_edge_reads_as_before() {
    let old: IslandPosition = serde_json::from_str(r#"{"x":420,"y":180}"#).unwrap();
    assert_eq!(old, IslandPosition::at(420, 180));
    assert_eq!(serde_json::to_string(&old).unwrap(), r#"{"x":420,"y":180}"#);

    let side: IslandPosition = serde_json::from_str(r#"{"x":0,"y":300,"edge":"left","along":0.25}"#).unwrap();
    assert_eq!(side.edge, Some(Edge::Left));
    assert_eq!(side.along, Some(0.25));
}

#[test]
fn a_bottom_docked_island_sits_at_the_bottom_of_its_stage() {
    let mut docked = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    docked.attached_edge = Some(Edge::Bottom);
    let (width, height) = (COLLAPSED_ISLAND_WIDTH, COLLAPSED_ISLAND_HEIGHT);
    let left = (STAGE_WINDOW_WIDTH - width) / 2.0;
    let rect = island_rect(100.0, 500.0, STAGE_WINDOW_WIDTH, 460.0, docked);
    assert_eq!(rect.top, 500.0 + 460.0 - height);
    assert_eq!(island_top_in_stage(None, 460.0, height), 0.0);

    let on = |x: f64, y: f64| cursor_on_island(0.0, 0.0, STAGE_WINDOW_WIDTH, 460.0, x, y, docked);
    assert!(on(left + width / 2.0, 459.0));
    assert!(on(left + 0.5, 459.5));
    assert!(on(left + width - 0.5, 459.5));
    assert!(!on(left + 0.5, 460.0 - height + 0.5));
    assert!(on(left + width / 2.0, 460.0 - height + 0.5));
    assert!(!on(left + width / 2.0, 10.0));
}

#[test]
fn passthrough_polling_slows_down_when_hidden_or_far_from_stage() {
    assert_eq!(passthrough_sleep_duration(false, true), PASSTHROUGH_HIDDEN_TICK);
    assert_eq!(passthrough_sleep_duration(false, false), PASSTHROUGH_HIDDEN_TICK);
    assert_eq!(passthrough_sleep_duration(true, true), PASSTHROUGH_FAST_TICK);
    assert_eq!(passthrough_sleep_duration(true, false), PASSTHROUGH_IDLE_TICK);

    assert!(cursor_near_stage(100.0, 0.0, STAGE_WINDOW_WIDTH, 460.0, 100.0, 0.0));
    assert!(cursor_near_stage(100.0, 0.0, STAGE_WINDOW_WIDTH, 460.0, -20.0, 580.0));
    assert!(!cursor_near_stage(100.0, 0.0, STAGE_WINDOW_WIDTH, 460.0, -21.0, 580.0));
    assert!(!cursor_near_stage(100.0, 0.0, STAGE_WINDOW_WIDTH, 460.0, 100.0, 581.0));

    assert_eq!(gaze_cursor_point((121.4, 38.9), true), (120.0, 40.0));
    assert_eq!(gaze_cursor_point((121.9, 39.8), true), (120.0, 40.0));
    assert_eq!(gaze_cursor_point((950.0, 520.0), false), (960.0, 528.0));
    assert_eq!(gaze_cursor_point((965.0, 534.0), false), (960.0, 528.0));
}

#[test]
fn tuck_styles_position_and_hit_test_across_dpi_scales() {
    assert_eq!(TuckStyle::from_value("edge"), Some(TuckStyle::Edge));
    assert_eq!(TuckStyle::from_value("line"), Some(TuckStyle::Line));
    assert_eq!(TuckStyle::from_value("hidden"), Some(TuckStyle::Hidden));
    assert_eq!(TuckStyle::from_value("custom"), None);
    assert_eq!(IslandWindowState::default().tuck_style, TuckStyle::Edge);

    for scale in [1.0, 1.25, 1.5, 2.0] {
        let stage_width = (STAGE_WINDOW_WIDTH * scale).round();
        let stage_height = (STAGE_WINDOW_HEIGHT * scale).round();
        let center_x = stage_width / 2.0;
        let island_width = COLLAPSED_ISLAND_WIDTH * scale;
        let island_left = (stage_width - island_width) / 2.0;

        let mut top_state = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
        top_state.is_tucked = true;
        top_state.attached_edge = Some(Edge::Top);

        top_state.tuck_style = TuckStyle::Edge;
        let top_edge_y = f64::from(tucked_top_offset(1.0, scale, TuckStyle::Edge));
        assert!(cursor_on_island(0.0, top_edge_y, stage_width, stage_height, center_x, 1.0 * scale, top_state));
        assert!(cursor_on_island(0.0, top_edge_y, stage_width, stage_height, center_x, 9.0 * scale, top_state));
        assert!(!cursor_on_island(0.0, top_edge_y, stage_width, stage_height, center_x, 11.0 * scale, top_state));

        top_state.tuck_style = TuckStyle::Line;
        let top_line_y = f64::from(tucked_top_offset(1.0, scale, TuckStyle::Line));
        assert!(cursor_on_island(0.0, top_line_y, stage_width, stage_height, center_x, 1.0 * scale, top_state));
        assert!(cursor_on_island(0.0, top_line_y, stage_width, stage_height, center_x, 3.5 * scale, top_state));
        assert!(!cursor_on_island(0.0, top_line_y, stage_width, stage_height, center_x, 5.0 * scale, top_state));

        top_state.tuck_style = TuckStyle::Hidden;
        let top_hidden_y = f64::from(tucked_top_offset(1.0, scale, TuckStyle::Hidden));
        assert_eq!(top_hidden_y, -(COLLAPSED_ISLAND_HEIGHT * scale).ceil());
        assert!(cursor_on_island(0.0, top_hidden_y, stage_width, stage_height, center_x, 0.0, top_state));
        assert!(cursor_on_island(0.0, top_hidden_y, stage_width, stage_height, island_left + 0.5, 1.5 * scale, top_state));
        assert!(cursor_on_island(0.0, top_hidden_y, stage_width, stage_height, center_x, 2.0 * scale, top_state));
        assert!(!cursor_on_island(0.0, top_hidden_y, stage_width, stage_height, center_x, 2.5 * scale, top_state));
        assert!(!cursor_on_island(0.0, top_hidden_y, stage_width, stage_height, island_left - 1.0, 1.0 * scale, top_state));

        let work_bottom = 1040.0 * scale;
        let mut bottom_state = top_state;
        bottom_state.attached_edge = Some(Edge::Bottom);

        bottom_state.tuck_style = TuckStyle::Edge;
        let bottom_edge_y = work_bottom - stage_height - f64::from(tucked_top_offset(1.0, scale, TuckStyle::Edge));
        assert!(cursor_on_island(0.0, bottom_edge_y, stage_width, stage_height, center_x, work_bottom - 1.0 * scale, bottom_state));
        assert!(cursor_on_island(0.0, bottom_edge_y, stage_width, stage_height, center_x, work_bottom - 9.0 * scale, bottom_state));
        assert!(!cursor_on_island(0.0, bottom_edge_y, stage_width, stage_height, center_x, work_bottom - 11.0 * scale, bottom_state));

        bottom_state.tuck_style = TuckStyle::Line;
        let bottom_line_y = work_bottom - stage_height - f64::from(tucked_top_offset(1.0, scale, TuckStyle::Line));
        assert!(cursor_on_island(0.0, bottom_line_y, stage_width, stage_height, center_x, work_bottom - 1.0 * scale, bottom_state));
        assert!(cursor_on_island(0.0, bottom_line_y, stage_width, stage_height, center_x, work_bottom - 3.5 * scale, bottom_state));
        assert!(!cursor_on_island(0.0, bottom_line_y, stage_width, stage_height, center_x, work_bottom - 5.0 * scale, bottom_state));

        bottom_state.tuck_style = TuckStyle::Hidden;
        let bottom_hidden_y = work_bottom - stage_height - f64::from(tucked_top_offset(1.0, scale, TuckStyle::Hidden));
        assert!(cursor_on_island(0.0, bottom_hidden_y, stage_width, stage_height, center_x, work_bottom, bottom_state));
        assert!(cursor_on_island(0.0, bottom_hidden_y, stage_width, stage_height, island_left + island_width - 0.5, work_bottom - 1.5 * scale, bottom_state));
        assert!(cursor_on_island(0.0, bottom_hidden_y, stage_width, stage_height, center_x, work_bottom - 2.0 * scale, bottom_state));
        assert!(!cursor_on_island(0.0, bottom_hidden_y, stage_width, stage_height, center_x, work_bottom - 2.5 * scale, bottom_state));
        assert!(!cursor_on_island(0.0, bottom_hidden_y, stage_width, stage_height, island_left + island_width + 1.0, work_bottom - 1.0 * scale, bottom_state));
    }
}

#[test]
fn shortcut_focus_survives_hover_release_and_restores_on_collapse() {
    use super::focus_slots::FocusSlots;

    let slots = FocusSlots::new();
    slots.note_hover(0);
    slots.note_expanded(0);
    assert_eq!(slots.take_hover(), None);
    assert_eq!(slots.take_expanded(), None);

    slots.note_expanded(41);
    assert_eq!(slots.take_hover(), None);
    assert_eq!(slots.take_hover(), None);
    slots.note_expanded(0);
    assert_eq!(slots.take_expanded(), Some(41));
    assert_eq!(slots.take_expanded(), None);

    slots.note_hover(52);
    assert_eq!(slots.take_hover(), Some(52));
    assert_eq!(slots.take_hover(), None);
    assert_eq!(slots.take_expanded(), None);

    slots.note_hover(63);
    slots.note_expanded(0);
    assert_eq!(slots.take_hover(), None);
    assert_eq!(slots.take_expanded(), Some(63));

    slots.note_hover(63);
    slots.note_expanded(74);
    assert_eq!(slots.take_hover(), None);
    assert_eq!(slots.take_expanded(), Some(74));
}

#[test]
fn dimmed_passthrough_ignores_island_clicks_only_while_collapsed_and_untucked() {
    let mut current = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    assert!(!current.dimmed_passthrough());
    assert!(!should_ignore_cursor(current, true, false));
    assert!(should_ignore_cursor(current, false, false));

    current.is_dimmed = true;
    assert!(current.dimmed_passthrough());
    assert!(should_ignore_cursor(current, true, false));
    assert!(should_ignore_cursor(current, false, false));
    assert!(!should_ignore_cursor(current, false, true));

    let mut expanded = current;
    expanded.mode = IslandMode::Expanded;
    assert!(!expanded.dimmed_passthrough());
    assert!(!should_ignore_cursor(expanded, true, false));

    let mut tucked = current;
    tucked.is_tucked = true;
    assert!(!tucked.dimmed_passthrough());
    assert!(!should_ignore_cursor(tucked, true, false));

    let mut dragging = current;
    dragging.is_dragging = true;
    assert!(!dragging.dimmed_passthrough());
    assert!(!should_ignore_cursor(dragging, true, false));
}

#[test]
fn game_passthrough_lets_clicks_through_only_the_tucked_strip() {
    let mut strip = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    strip.is_tucked = true;
    assert!(!should_ignore_cursor(strip, true, false));
    assert!(hover_inside(strip, true));

    strip.game_passthrough = true;
    assert!(strip.game_strip_passthrough());
    assert!(should_ignore_cursor(strip, true, false));
    assert!(should_ignore_cursor(strip, true, true));
    assert!(!hover_inside(strip, true));

    let mut untucked = strip;
    untucked.is_tucked = false;
    assert!(!untucked.game_strip_passthrough());
    assert!(!should_ignore_cursor(untucked, true, false));
    assert!(hover_inside(untucked, true));

    let mut expanded = strip;
    expanded.mode = IslandMode::Expanded;
    assert!(!expanded.game_strip_passthrough());
    assert!(!should_ignore_cursor(expanded, true, false));
    assert!(hover_inside(expanded, true));

    let mut dragging = strip;
    dragging.is_dragging = true;
    assert!(!dragging.game_strip_passthrough());
    assert!(!should_ignore_cursor(dragging, true, false));

    let mut left_game = strip;
    left_game.game_passthrough = false;
    assert!(!should_ignore_cursor(left_game, true, false));
    assert!(hover_inside(left_game, true));
    assert!(should_ignore_cursor(left_game, false, false));
}

#[test]
fn cursor_near_island_and_dim_wake_tracker_handle_approach_and_parked_cursor() {
    for scale in [1.0, 1.25, 1.5, 2.0] {
        let stage_width = (STAGE_WINDOW_WIDTH * scale).round();
        let stage_height = (STAGE_WINDOW_HEIGHT * scale).round();
        let center_x = stage_width / 2.0;
        let collapsed = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
        let bottom_y = COLLAPSED_ISLAND_HEIGHT * scale;

        assert!(cursor_near_island(0.0, 0.0, stage_width, stage_height, center_x, bottom_y + (DIM_WAKE_MARGIN - 1.0) * scale, collapsed));
        assert!(!cursor_near_island(0.0, 0.0, stage_width, stage_height, center_x, bottom_y + (DIM_WAKE_MARGIN + 2.0) * scale, collapsed));
    }

    let mut tracker = DimWakeTracker::default();
    assert!(!tracker.poll(false, false, Some((10.0, 200.0))));
    assert!(!tracker.poll(true, false, Some((10.0, 200.0))));
    assert!(tracker.poll(true, true, Some((400.0, 50.0))));

    let mut parked = DimWakeTracker::default();
    assert!(!parked.poll(false, true, Some((410.0, 18.0))));
    assert!(!parked.poll(true, true, Some((410.0, 18.0))));
    assert!(!parked.poll(true, true, Some((411.0, 18.5))));
    assert!(parked.poll(true, true, Some((413.0, 18.0))));

    let mut reenter = DimWakeTracker::default();
    assert!(!reenter.poll(false, true, Some((410.0, 18.0))));
    assert!(!reenter.poll(true, true, Some((410.0, 18.0))));
    assert!(!reenter.poll(true, false, Some((410.0, 120.0))));
    assert!(reenter.poll(true, true, Some((410.0, 18.0))));
}

#[test]
fn ordinary_open_and_close_skip_stage_geometry_until_stage_inputs_change() {
    assert_eq!(DEFAULT_EXPANDED_ISLAND_HEIGHT, 360.0);

    let collapsed = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    assert!(should_apply_stage_geometry(&collapsed, &collapsed, false));
    assert!(!should_apply_stage_geometry(&collapsed, &collapsed, true));

    let mut expanded = collapsed;
    expanded.mode = IslandMode::Expanded;
    expanded.collapsed_width = 312.0;
    expanded.expanded_width = 800.0;
    expanded.is_dimmed = true;
    expanded.corner_radius = 24.0;
    expanded.corner_shape = CornerShape::Round;
    expanded.top_fillet_radius = 4.0;
    expanded.glass_enabled = true;
    expanded.glass_native = true;
    expanded.glass_intensity = 45.0;
    expanded.glass_tint_rgb = (18, 22, 30);
    expanded.expanded_height = 130.0;
    assert!(!stage_geometry_inputs_changed(&collapsed, &expanded));
    assert!(!should_apply_stage_geometry(&collapsed, &expanded, true));

    let mut taller = expanded;
    taller.expanded_height = 490.0;
    assert!(stage_geometry_inputs_changed(&collapsed, &taller));
    assert!(!stage_geometry_inputs_changed(
        &state(IslandMode::Collapsed, 1.0, 490.0),
        &taller,
    ));

    let mut tucked = collapsed;
    tucked.is_tucked = true;
    assert!(stage_geometry_inputs_changed(&collapsed, &tucked));

    let mut margined = collapsed;
    margined.margin_y = 12.0;
    assert!(stage_geometry_inputs_changed(&collapsed, &margined));

    let mut side_collapsed = collapsed;
    side_collapsed.attached_edge = Some(Edge::Left);
    side_collapsed.custom_position = Some(IslandPosition {
        x: 0,
        y: 420,
        edge: Some(Edge::Left),
        along: Some(0.5),
    });
    let mut side_expanded = side_collapsed;
    side_expanded.mode = IslandMode::Expanded;
    assert!(stage_geometry_inputs_changed(&side_collapsed, &side_expanded));
}

#[test]
fn a_hidden_side_handle_only_catches_the_edge_strip() {
    for scale in [1.0, 1.5, 2.0] {
        let stage_width = (STAGE_WINDOW_WIDTH * scale).round();
        let stage_height = (STAGE_WINDOW_HEIGHT * scale).round();
        let handle_height = SIDE_HANDLE_HEIGHT * scale;
        let middle = handle_height / 2.0;
        for edge in [Edge::Left, Edge::Right] {
            let mut side = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
            side.attached_edge = Some(edge);
            side.is_tucked = true;
            let x_at = |depth: f64| if edge == Edge::Left { depth } else { stage_width - depth };
            let on = |state: IslandWindowState, depth: f64, y: f64| cursor_on_island(0.0, 0.0, stage_width, stage_height, x_at(depth), y, state);

            side.tuck_style = TuckStyle::Edge;
            assert!(on(side, 8.0 * scale, middle));

            side.tuck_style = TuckStyle::Hidden;
            assert!(on(side, 0.5, middle));
            assert!(on(side, 2.0 * scale, middle));
            assert!(!on(side, 3.0 * scale, middle));
            assert!(!on(side, 8.0 * scale, middle));
            assert!(!on(side, 1.0, handle_height + 1.0));
        }
    }
}

#[test]
fn a_grown_message_preview_takes_clicks_on_its_whole_height() {
    let mut grown = state(IslandMode::Collapsed, 1.0, DEFAULT_EXPANDED_ISLAND_HEIGHT);
    grown.collapsed_width = 480.0;
    grown.collapsed_height = 96.0;
    let center_x = STAGE_WINDOW_WIDTH / 2.0;
    let on = |state: IslandWindowState, x: f64, y: f64| cursor_on_island(0.0, 0.0, STAGE_WINDOW_WIDTH, 460.0, x, y, state);
    assert_eq!(grown.base_size(), (480.0, 96.0));
    assert!(on(grown, center_x, 90.0));
    assert!(!on(grown, center_x, 100.0));
    assert!(on(grown, center_x - 230.0, 40.0));
    assert!(!on(grown, center_x - 250.0, 40.0));

    let mut bottom = grown;
    bottom.attached_edge = Some(Edge::Bottom);
    assert!(on(bottom, center_x, 460.0 - 90.0));
    assert!(!on(bottom, center_x, 460.0 - 100.0));

    let mut tucked = grown;
    tucked.is_tucked = true;
    assert_eq!(tucked.base_size().1, COLLAPSED_ISLAND_HEIGHT);
    let mut expanded = grown;
    expanded.mode = IslandMode::Expanded;
    assert_eq!(expanded.base_size().1, DEFAULT_EXPANDED_ISLAND_HEIGHT);
}

#[test]
fn the_collapsed_height_stays_between_the_bar_and_its_ceiling() {
    assert_eq!(grown_collapsed_height(10.0), COLLAPSED_ISLAND_HEIGHT);
    assert_eq!(grown_collapsed_height(96.0), 96.0);
    assert_eq!(grown_collapsed_height(1000.0), MAX_GROWN_COLLAPSED_HEIGHT);
    assert_eq!(grown_collapsed_height(f64::NAN), COLLAPSED_ISLAND_HEIGHT);
}
