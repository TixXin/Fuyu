use super::{
    build_mask_plan, choose_backend, effect_box_in_view, has_glass_effect_view, pixel_alpha,
    point_inside_contour, rasterize_mask_png, GlassCornerShape, GlassEdge, NativeGlassDecision,
    NativeGlassSpec,
};

fn sample_spec() -> NativeGlassSpec {
    NativeGlassSpec {
        enabled: true,
        notch_collapsed: false,
        tucked_hidden: false,
        stage_height: 460.0,
        left: 240.0,
        top: 0.0,
        width: 340.0,
        height: 38.0,
        top_radius: 0.0,
        bottom_radius: 22.0,
        fillet_radius: 8.0,
        corner_shape: GlassCornerShape::Squircle,
        edge: Some(GlassEdge::Top),
        light: false,
        tint_rgba: Some((47, 47, 55, 90)),
    }
}

#[test]
fn decision_honours_notch_collapsed_reduce_transparency_and_macos26_capsule() {
    let docked = sample_spec();
    assert_eq!(choose_backend(&docked, false, true), NativeGlassDecision::VisualEffectView);
    assert_eq!(choose_backend(&docked, true, true), NativeGlassDecision::CssFallback);

    let notch = NativeGlassSpec { notch_collapsed: true, ..docked };
    assert_eq!(choose_backend(&notch, false, true), NativeGlassDecision::Disabled);
    assert_eq!(notch_state(&notch), "disabled");

    let detached = NativeGlassSpec {
        edge: None,
        top: 10.0,
        top_radius: 22.0,
        fillet_radius: 0.0,
        ..docked
    };
    assert_eq!(choose_backend(&detached, false, true), NativeGlassDecision::GlassEffectView);
    assert_eq!(choose_backend(&detached, false, false), NativeGlassDecision::VisualEffectView);
}

fn notch_state(spec: &NativeGlassSpec) -> &'static str {
    choose_backend(spec, false, has_glass_effect_view()).state_name()
}

#[test]
fn effect_box_expands_for_fillets_and_flips_appkit_vertical_origin() {
    let top_spec = sample_spec();
    let unflipped = effect_box_in_view(&top_spec, 460.0, false);
    assert_eq!((unflipped.x, unflipped.y, unflipped.width, unflipped.height), (232.0, 422.0, 356.0, 38.0));

    let flipped = effect_box_in_view(&top_spec, 460.0, true);
    assert_eq!((flipped.x, flipped.y), (232.0, 0.0));

    let left_spec = NativeGlassSpec {
        left: 0.0,
        top: 120.0,
        width: 44.0,
        height: 180.0,
        edge: Some(GlassEdge::Left),
        ..top_spec
    };
    let side_box = effect_box_in_view(&left_spec, 460.0, false);
    assert_eq!((side_box.x, side_box.y, side_box.width, side_box.height), (0.0, 152.0, 44.0, 196.0));
}

#[test]
fn top_docked_mask_keeps_flush_top_concave_fillets_and_squircle_bottom() {
    let spec = sample_spec();
    let plan = build_mask_plan(&spec, 356.0, 38.0, 2.0);
    assert!(plan.key.stretchable);
    assert!(point_inside_contour(&plan, plan.logical_width / 2.0, 0.5), "top centre is flush");
    assert!(point_inside_contour(&plan, 6.5, 0.5), "inside top-left reverse fillet wing");
    assert!(!point_inside_contour(&plan, 1.0, 7.0), "under top-left reverse fillet arc is transparent");
    assert!(
        !point_inside_contour(&plan, plan.fillet + 1.0, plan.logical_height - 1.0),
        "outside bottom-left squircle corner is transparent"
    );
    assert!(point_inside_contour(&plan, plan.logical_width / 2.0, plan.logical_height - 1.0));
    assert_eq!(pixel_alpha(&plan, plan.pixel_width / 2, 1), 255);
    assert_eq!(pixel_alpha(&plan, 1, plan.pixel_height - 1), 0);

    let png = rasterize_mask_png(&plan).expect("mask PNG encodes");
    assert!(png.starts_with(b"\x89PNG"));
}

#[test]
fn bottom_and_side_docked_masks_mirror_and_rotate_cleanly() {
    let base = sample_spec();
    let bottom = NativeGlassSpec { top: 422.0, edge: Some(GlassEdge::Bottom), ..base };
    let bottom_plan = build_mask_plan(&bottom, 356.0, 38.0, 2.0);
    assert!(
        point_inside_contour(&bottom_plan, 6.5, bottom_plan.logical_height - 0.5),
        "bottom docked reverse fillet sits at bottom edge"
    );
    assert!(!point_inside_contour(&bottom_plan, 1.0, bottom_plan.logical_height - 7.0));

    let right = NativeGlassSpec {
        left: 776.0,
        top: 100.0,
        width: 44.0,
        height: 180.0,
        bottom_radius: 22.0,
        edge: Some(GlassEdge::Right),
        ..base
    };
    let right_plan = build_mask_plan(&right, 44.0, 196.0, 2.0);
    assert!(
        point_inside_contour(&right_plan, right_plan.logical_width - 0.5, 6.5),
        "right docked reverse fillet sits along right screen edge"
    );
    assert!(!point_inside_contour(&right_plan, right_plan.logical_width - 7.0, 1.0));
}
