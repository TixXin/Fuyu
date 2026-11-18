#[cfg(target_os = "macos")]
#[path = "../src/macos/island_glass.rs"]
#[allow(dead_code)]
mod island_glass;

#[cfg(not(target_os = "macos"))]
fn main() {
    println!("macos_native_glass_probe only runs on macOS.");
}

#[cfg(target_os = "macos")]
fn main() {
    use std::ffi::c_int;
    use std::time::{Duration, Instant};

    use island_glass::{
        build_mask_plan, has_glass_effect_view, rasterize_mask_png, should_reduce_transparency,
        sync_window_glass, GlassCornerShape, GlassEdge, NativeGlassSpec,
    };
    use libc::{rusage_info_t, rusage_info_v2, RUSAGE_INFO_V2};
    use objc2::MainThreadOnly;
    use objc2_app_kit::{
        NSApplication, NSApplicationActivationPolicy, NSBackingStoreType, NSColor, NSEventMask,
        NSPanel, NSWindowStyleMask,
    };
    use objc2_foundation::{MainThreadMarker, NSDate, NSDefaultRunLoopMode, NSPoint, NSRect, NSSize};

    fn sample_rusage() -> (f64, u64) {
        let Ok(pid) = c_int::try_from(std::process::id()) else {
            return (0.0, 0);
        };
        let mut info: rusage_info_v2 = unsafe { std::mem::zeroed() };
        let rc = unsafe {
            libc::proc_pid_rusage(
                pid,
                RUSAGE_INFO_V2,
                (&mut info as *mut rusage_info_v2).cast::<rusage_info_t>(),
            )
        };
        if rc != 0 {
            return (0.0, 0);
        }
        let mb = info.ri_phys_footprint as f64 / (1024.0 * 1024.0);
        let cpu_ns = info.ri_user_time.saturating_add(info.ri_system_time);
        (mb, cpu_ns)
    }

    fn pump_events(app: &NSApplication, duration: Duration, mut on_tick: impl FnMut(f64)) {
        let start = Instant::now();
        while start.elapsed() < duration {
            let progress = (start.elapsed().as_secs_f64() / duration.as_secs_f64()).clamp(0.0, 1.0);
            on_tick(progress);
            let until = NSDate::dateWithTimeIntervalSinceNow(1.0 / 60.0);
            while let Some(event) = unsafe {
                app.nextEventMatchingMask_untilDate_inMode_dequeue(
                    NSEventMask::Any,
                    Some(&until),
                    NSDefaultRunLoopMode,
                    true,
                )
            } {
                app.sendEvent(&event);
                let next_now = NSDate::distantPast();
                if unsafe {
                    app.nextEventMatchingMask_untilDate_inMode_dequeue(
                        NSEventMask::Any,
                        Some(&next_now),
                        NSDefaultRunLoopMode,
                        false,
                    )
                }
                .is_none()
                {
                    break;
                }
            }
        }
    }

    let Some(mtm) = MainThreadMarker::new() else {
        eprintln!("Must run on main thread.");
        return;
    };

    let app = NSApplication::sharedApplication(mtm);
    let _ = app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);

    let frame = NSRect::new(NSPoint::new(180.0, 420.0), NSSize::new(820.0, 460.0));
    let style = NSWindowStyleMask::Borderless | NSWindowStyleMask::NonactivatingPanel;
    let panel = NSPanel::initWithContentRect_styleMask_backing_defer(
        NSPanel::alloc(mtm),
        frame,
        style,
        NSBackingStoreType::Buffered,
        false,
    );
    panel.setOpaque(false);
    panel.setBackgroundColor(Some(&NSColor::clearColor()));
    panel.setHasShadow(false);
    panel.setIgnoresMouseEvents(true);
    panel.orderFrontRegardless();

    println!("=== macOS Native Glass Probe ===");
    println!("NSGlassEffectView available: {}", has_glass_effect_view());
    println!("Reduce Transparency active:  {}", should_reduce_transparency());

    let docked_base = NativeGlassSpec {
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
        tint_rgba: Some((30, 34, 44, 72)),
    };

    let mask_plan = build_mask_plan(&docked_base, 356.0, 38.0, 2.0);
    let cold_start = Instant::now();
    let png_bytes = rasterize_mask_png(&mask_plan).map(|v| v.len()).unwrap_or(0);
    let cold_us = cold_start.elapsed().as_micros();
    println!(
        "9-slice mask cold build: {}x{} px ({} B PNG) in {} us (stretchable={})",
        mask_plan.pixel_width,
        mask_plan.pixel_height,
        png_bytes,
        cold_us,
        mask_plan.key.stretchable
    );

    let measure_phase = |name: &str, duration: Duration, mut tick: Box<dyn FnMut(f64)>| {
        let (_, cpu_before) = sample_rusage();
        let wall_before = Instant::now();
        pump_events(&app, duration, &mut *tick);
        let wall_ns = wall_before.elapsed().as_nanos() as f64;
        let (rss_mb, cpu_after) = sample_rusage();
        let cpu_pct = ((cpu_after.saturating_sub(cpu_before)) as f64 / wall_ns) * 100.0;
        println!("{name:<42} | phys_footprint: {rss_mb:6.2} MB | CPU: {cpu_pct:5.2}%");
    };

    let disabled_spec = NativeGlassSpec { enabled: false, ..docked_base };
    let _ = sync_window_glass(&panel, &disabled_spec, mtm);
    pump_events(&app, Duration::from_millis(250), |_| {});
    measure_phase(
        "0. Baseline panel (native glass disabled, idle)",
        Duration::from_millis(1200),
        Box::new(|_| {}),
    );

    let d1 = sync_window_glass(&panel, &docked_base, mtm);
    println!("1. Activated docked spec -> {:?}", d1);
    pump_events(&app, Duration::from_millis(250), |_| {});
    measure_phase(
        "1. NSVisualEffectView 9-slice docked (idle)",
        Duration::from_millis(1200),
        Box::new(|_| {}),
    );

    let panel_ref = &panel;
    measure_phase(
        "2. NSVisualEffectView 60fps expand/collapse",
        Duration::from_millis(1200),
        Box::new(move |p| {
            let t = if p < 0.5 { p * 2.0 } else { (1.0 - p) * 2.0 };
            let eased = 1.0 - (1.0 - t).powi(3);
            let w = 340.0 + (560.0 - 340.0) * eased;
            let h = 38.0 + (420.0 - 38.0) * eased;
            let spec = NativeGlassSpec {
                left: (820.0 - w) / 2.0,
                width: w,
                height: h,
                bottom_radius: 22.0 + (30.0 - 22.0) * eased,
                ..docked_base
            };
            let _ = sync_window_glass(panel_ref, &spec, mtm);
        }),
    );

    let capsule_base = NativeGlassSpec {
        edge: None,
        top: 10.0,
        top_radius: 22.0,
        fillet_radius: 0.0,
        ..docked_base
    };
    let d3 = sync_window_glass(&panel, &capsule_base, mtm);
    println!("3. Activated detached capsule spec -> {:?}", d3);
    pump_events(&app, Duration::from_millis(250), |_| {});
    measure_phase(
        "3. NSGlassEffectView capsule (idle)",
        Duration::from_millis(1200),
        Box::new(|_| {}),
    );

    let panel_ref2 = &panel;
    measure_phase(
        "4. NSGlassEffectView 60fps expand/collapse",
        Duration::from_millis(1200),
        Box::new(move |p| {
            let t = if p < 0.5 { p * 2.0 } else { (1.0 - p) * 2.0 };
            let eased = 1.0 - (1.0 - t).powi(3);
            let w = 340.0 + (560.0 - 340.0) * eased;
            let h = 38.0 + (420.0 - 38.0) * eased;
            let r = 22.0 + (30.0 - 22.0) * eased;
            let spec = NativeGlassSpec {
                left: (820.0 - w) / 2.0,
                width: w,
                height: h,
                top_radius: r,
                bottom_radius: r,
                ..capsule_base
            };
            let _ = sync_window_glass(panel_ref2, &spec, mtm);
        }),
    );

    let notch_collapsed = NativeGlassSpec { notch_collapsed: true, ..docked_base };
    let d4 = sync_window_glass(&panel, &notch_collapsed, mtm);
    println!("5. Notch collapsed fallback -> {:?} (state={})", d4, d4.state_name());

    panel.orderOut(None);
}
