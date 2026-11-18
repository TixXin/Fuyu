use std::cell::RefCell;
use std::io::Cursor;

use image::{ImageBuffer, ImageFormat, Rgba};
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject};
use objc2::{define_class, msg_send, sel, AnyThread, MainThreadOnly};
use objc2_app_kit::{
    NSAppearance, NSAppearanceCustomization, NSAppearanceNameVibrantDark,
    NSAppearanceNameVibrantLight, NSColor, NSImage, NSImageResizingMode, NSView,
    NSVisualEffectBlendingMode, NSVisualEffectMaterial, NSVisualEffectState, NSVisualEffectView,
    NSWindow, NSWindowOrderingMode, NSWorkspace,
};
use objc2_foundation::{MainThreadMarker, NSEdgeInsets, NSData, NSObject, NSObjectProtocol, NSPoint, NSRect, NSSize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum GlassEdge {
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum GlassCornerShape {
    Round,
    Squircle,
}

impl GlassCornerShape {
    pub fn contains(self, dx: f64, dy: f64, radius: f64) -> bool {
        if radius <= 0.0 {
            return true;
        }
        match self {
            Self::Round => dx * dx + dy * dy <= radius * radius,
            Self::Squircle => dx.powi(4) + dy.powi(4) <= radius.powi(4),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct NativeGlassSpec {
    pub enabled: bool,
    pub notch_collapsed: bool,
    pub tucked_hidden: bool,
    pub stage_height: f64,
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
    pub top_radius: f64,
    pub bottom_radius: f64,
    pub fillet_radius: f64,
    pub corner_shape: GlassCornerShape,
    pub edge: Option<GlassEdge>,
    pub light: bool,
    pub tint_rgba: Option<(u8, u8, u8, u8)>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NativeGlassDecision {
    Disabled,
    CssFallback,
    GlassEffectView,
    VisualEffectView,
}

impl NativeGlassDecision {
    pub fn state_name(self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::CssFallback => "css-fallback",
            Self::GlassEffectView | Self::VisualEffectView => "active",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct EffectBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct MaskKey {
    pub logical_width_tenths: u32,
    pub logical_height_tenths: u32,
    pub top_radius_tenths: u32,
    pub bottom_radius_tenths: u32,
    pub fillet_tenths: u32,
    pub scale_tenths: u32,
    pub corner_shape: GlassCornerShape,
    pub edge: Option<GlassEdge>,
    pub stretchable: bool,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MaskPlan {
    pub key: MaskKey,
    pub logical_width: f64,
    pub logical_height: f64,
    pub pixel_width: u32,
    pub pixel_height: u32,
    pub top_cap: f64,
    pub left_cap: f64,
    pub bottom_cap: f64,
    pub right_cap: f64,
    pub top_radius: f64,
    pub bottom_radius: f64,
    pub fillet: f64,
    pub corner_shape: GlassCornerShape,
    pub edge: Option<GlassEdge>,
}

const STRETCH_CENTER_PT: f64 = 6.0;
const SUPERSAMPLES: u32 = 4;

define_class!(
    #[unsafe(super(NSView, objc2_app_kit::NSResponder, NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "FuyuIslandGlassHostView"]
    struct IslandGlassHostView;

    unsafe impl NSObjectProtocol for IslandGlassHostView {}

    impl IslandGlassHostView {
        #[unsafe(method(hitTest:))]
        fn hit_test(&self, _point: NSPoint) -> *mut NSView {
            std::ptr::null_mut()
        }
    }
);

struct MountedGlass {
    window_number: isize,
    host: Retained<IslandGlassHostView>,
    visual: Retained<NSVisualEffectView>,
    glass: Option<Retained<NSView>>,
    cached_mask: Option<(MaskKey, Retained<NSImage>)>,
}

thread_local! {
    static MOUNTED: RefCell<Option<MountedGlass>> = const { RefCell::new(None) };
}

pub fn has_glass_effect_view() -> bool {
    AnyClass::get(c"NSGlassEffectView").is_some()
}

pub fn should_reduce_transparency() -> bool {
    NSWorkspace::sharedWorkspace().accessibilityDisplayShouldReduceTransparency()
}

pub fn choose_backend(
    spec: &NativeGlassSpec,
    reduce_transparency: bool,
    glass_effect_available: bool,
) -> NativeGlassDecision {
    if !spec.enabled || spec.notch_collapsed || spec.tucked_hidden {
        return NativeGlassDecision::Disabled;
    }
    if reduce_transparency {
        return NativeGlassDecision::CssFallback;
    }
    if spec.edge.is_none() && glass_effect_available {
        return NativeGlassDecision::GlassEffectView;
    }
    NativeGlassDecision::VisualEffectView
}

pub fn effect_box_in_view(spec: &NativeGlassSpec, content_height: f64, content_is_flipped: bool) -> EffectBox {
    let fillet = if spec.edge.is_some() { spec.fillet_radius.max(0.0) } else { 0.0 };
    let (left, top, width, height) = match spec.edge {
        Some(GlassEdge::Top | GlassEdge::Bottom) => (
            spec.left - fillet,
            spec.top,
            (spec.width + 2.0 * fillet).max(1.0),
            spec.height.max(1.0),
        ),
        Some(GlassEdge::Left | GlassEdge::Right) => (
            spec.left,
            spec.top - fillet,
            spec.width.max(1.0),
            (spec.height + 2.0 * fillet).max(1.0),
        ),
        None => (spec.left, spec.top, spec.width.max(1.0), spec.height.max(1.0)),
    };
    let y = if content_is_flipped {
        top
    } else {
        content_height - top - height
    };
    EffectBox { x: left, y, width, height }
}

fn tenths(value: f64) -> u32 {
    (value.max(0.0) * 10.0).round() as u32
}

pub fn build_mask_plan(spec: &NativeGlassSpec, box_width: f64, box_height: f64, backing_scale: f64) -> MaskPlan {
    let scale = backing_scale.clamp(1.0, 3.0);
    let fillet = if spec.edge.is_some() { spec.fillet_radius.max(0.0) } else { 0.0 };
    let top_radius = if spec.edge.is_some() { 0.0 } else { spec.top_radius.max(0.0) };
    let bottom_radius = spec.bottom_radius.max(0.0);

    let (top_cap, bottom_cap, left_cap, right_cap) = match spec.edge {
        Some(GlassEdge::Top) => {
            let side = (fillet + bottom_radius).ceil() + 1.0;
            (fillet.ceil() + 1.0, bottom_radius.ceil() + 1.0, side, side)
        }
        Some(GlassEdge::Bottom) => {
            let side = (fillet + bottom_radius).ceil() + 1.0;
            (bottom_radius.ceil() + 1.0, fillet.ceil() + 1.0, side, side)
        }
        Some(GlassEdge::Left) => {
            let vert = (fillet + bottom_radius).ceil() + 1.0;
            (vert, vert, fillet.ceil() + 1.0, bottom_radius.ceil() + 1.0)
        }
        Some(GlassEdge::Right) => {
            let vert = (fillet + bottom_radius).ceil() + 1.0;
            (vert, vert, bottom_radius.ceil() + 1.0, fillet.ceil() + 1.0)
        }
        None => {
            let horiz = top_radius.max(bottom_radius).ceil() + 1.0;
            (top_radius.ceil() + 1.0, bottom_radius.ceil() + 1.0, horiz, horiz)
        }
    };

    let min_stretch_w = left_cap + right_cap + STRETCH_CENTER_PT;
    let min_stretch_h = top_cap + bottom_cap + STRETCH_CENTER_PT;
    let stretchable = box_width >= min_stretch_w && box_height >= min_stretch_h;
    let logical_width = if stretchable { min_stretch_w } else { box_width.max(2.0).ceil() };
    let logical_height = if stretchable { min_stretch_h } else { box_height.max(2.0).ceil() };
    let pixel_width = ((logical_width * scale).round() as u32).max(2);
    let pixel_height = ((logical_height * scale).round() as u32).max(2);

    let key = MaskKey {
        logical_width_tenths: tenths(logical_width),
        logical_height_tenths: tenths(logical_height),
        top_radius_tenths: tenths(top_radius),
        bottom_radius_tenths: tenths(bottom_radius),
        fillet_tenths: tenths(fillet),
        scale_tenths: tenths(scale),
        corner_shape: spec.corner_shape,
        edge: spec.edge,
        stretchable,
    };

    MaskPlan {
        key,
        logical_width,
        logical_height,
        pixel_width,
        pixel_height,
        top_cap: if stretchable { top_cap } else { 0.0 },
        left_cap: if stretchable { left_cap } else { 0.0 },
        bottom_cap: if stretchable { bottom_cap } else { 0.0 },
        right_cap: if stretchable { right_cap } else { 0.0 },
        top_radius,
        bottom_radius,
        fillet,
        corner_shape: spec.corner_shape,
        edge: spec.edge,
    }
}

pub fn point_inside_contour(plan: &MaskPlan, x: f64, y: f64) -> bool {
    let w = plan.logical_width;
    let h = plan.logical_height;
    if x < 0.0 || x > w || y < 0.0 || y > h {
        return false;
    }
    let (u, v, cw, ch, f) = match plan.edge {
        None => (x, y, w, h, 0.0),
        Some(GlassEdge::Top) => (x, y, w, h, plan.fillet),
        Some(GlassEdge::Bottom) => (x, h - y, w, h, plan.fillet),
        Some(GlassEdge::Left) => (y, x, h, w, plan.fillet),
        Some(GlassEdge::Right) => (y, w - x, h, w, plan.fillet),
    };

    if u < f {
        return f > 0.0 && v <= f && (u * u + (f - v) * (f - v) >= f * f);
    }
    if u > cw - f {
        let rx = cw - u;
        return f > 0.0 && v <= f && (rx * rx + (f - v) * (f - v) >= f * f);
    }

    let bw = (cw - 2.0 * f).max(0.0);
    let bx = u - f;
    let rt = plan.top_radius.min(bw / 2.0).min(ch / 2.0);
    if rt > 0.0 && v < rt {
        if bx < rt {
            return plan.corner_shape.contains(rt - bx, rt - v, rt);
        }
        if bx > bw - rt {
            return plan.corner_shape.contains(bx - (bw - rt), rt - v, rt);
        }
    }

    let rb = plan.bottom_radius.min(bw / 2.0).min(ch / 2.0);
    if rb > 0.0 && v > ch - rb {
        let dy = v - (ch - rb);
        if bx < rb {
            return plan.corner_shape.contains(rb - bx, dy, rb);
        }
        if bx > bw - rb {
            return plan.corner_shape.contains(bx - (bw - rb), dy, rb);
        }
    }
    true
}

pub fn pixel_alpha(plan: &MaskPlan, px: u32, py: u32) -> u8 {
    let sx_scale = plan.logical_width / f64::from(plan.pixel_width);
    let sy_scale = plan.logical_height / f64::from(plan.pixel_height);
    let mut hits = 0u32;
    for sy in 0..SUPERSAMPLES {
        let y = (f64::from(py) + (f64::from(sy) + 0.5) / f64::from(SUPERSAMPLES)) * sy_scale;
        for sx in 0..SUPERSAMPLES {
            let x = (f64::from(px) + (f64::from(sx) + 0.5) / f64::from(SUPERSAMPLES)) * sx_scale;
            if point_inside_contour(plan, x, y) {
                hits += 1;
            }
        }
    }
    u8::try_from(hits * 255 / (SUPERSAMPLES * SUPERSAMPLES)).unwrap_or(u8::MAX)
}

pub fn rasterize_mask_png(plan: &MaskPlan) -> Result<Vec<u8>, String> {
    let mut buffer = ImageBuffer::<Rgba<u8>, Vec<u8>>::new(plan.pixel_width, plan.pixel_height);
    for py in 0..plan.pixel_height {
        let flipped_py = plan.pixel_height - 1 - py;
        for px in 0..plan.pixel_width {
            let a = pixel_alpha(plan, px, py);
            buffer.put_pixel(px, flipped_py, Rgba([0, 0, 0, a]));
        }
    }
    let mut encoded = Vec::new();
    buffer
        .write_to(&mut Cursor::new(&mut encoded), ImageFormat::Png)
        .map_err(|error| format!("Could not encode native glass mask: {error}"))?;
    Ok(encoded)
}

fn build_mask_nsimage(plan: &MaskPlan) -> Option<Retained<NSImage>> {
    let png = rasterize_mask_png(plan).ok()?;
    let data = NSData::from_vec(png);
    let image = NSImage::initWithData(NSImage::alloc(), &data)?;
    image.setSize(NSSize::new(plan.logical_width, plan.logical_height));
    image.setCapInsets(NSEdgeInsets {
        top: plan.top_cap,
        left: plan.left_cap,
        bottom: plan.bottom_cap,
        right: plan.right_cap,
    });
    image.setResizingMode(NSImageResizingMode::Stretch);
    image.setTemplate(true);
    Some(image)
}

fn create_glass_effect_view(frame: NSRect) -> Option<Retained<NSView>> {
    let cls = AnyClass::get(c"NSGlassEffectView")?;
    let raw: *mut AnyObject = unsafe { msg_send![cls, alloc] };
    if raw.is_null() {
        return None;
    }
    let initialized: *mut NSView = unsafe { msg_send![raw, initWithFrame: frame] };
    unsafe { Retained::from_raw(initialized) }
}

fn apply_view_appearance(view: &NSView, light: bool) {
    let appearance_name = unsafe {
        if light {
            NSAppearanceNameVibrantLight
        } else {
            NSAppearanceNameVibrantDark
        }
    };
    if let Some(appearance) = NSAppearance::appearanceNamed(appearance_name) {
        view.setAppearance(Some(&appearance));
    }
}

fn configure_glass_effect_view(
    view: &NSView,
    radius: f64,
    light: bool,
    tint_rgba: Option<(u8, u8, u8, u8)>,
) {
    apply_view_appearance(view, light);
    let has_style: bool = unsafe { msg_send![view, respondsToSelector: sel!(setStyle:)] };
    if has_style {
        let clear_style: isize = 1;
        let _: () = unsafe { msg_send![view, setStyle: clear_style] };
    }
    let has_radius: bool = unsafe { msg_send![view, respondsToSelector: sel!(setCornerRadius:)] };
    if has_radius {
        let _: () = unsafe { msg_send![view, setCornerRadius: radius.max(0.0)] };
    }
    let has_tint: bool = unsafe { msg_send![view, respondsToSelector: sel!(setTintColor:)] };
    if has_tint {
        let color = tint_rgba.map(|(r, g, b, a)| {
            NSColor::colorWithSRGBRed_green_blue_alpha(
                f64::from(r) / 255.0,
                f64::from(g) / 255.0,
                f64::from(b) / 255.0,
                f64::from(a) / 255.0,
            )
        });
        let ptr: Option<&NSColor> = color.as_deref();
        let _: () = unsafe { msg_send![view, setTintColor: ptr] };
    }
}

fn ensure_mounted(window: &NSWindow, mtm: MainThreadMarker) -> Option<()> {
    let window_number = window.windowNumber();
    let content_view = window.contentView()?;
    MOUNTED.with(|slot| {
        let mut borrow = slot.borrow_mut();
        let reuse = borrow.as_ref().is_some_and(|item| {
            item.window_number == window_number && unsafe { item.host.superview() }.is_some()
        });
        if reuse {
            return Some(());
        }
        if let Some(previous) = borrow.take() {
            previous.host.removeFromSuperview();
        }
        let zero = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0));
        let host: Retained<IslandGlassHostView> = unsafe { msg_send![IslandGlassHostView::alloc(mtm), initWithFrame: zero] };
        host.setHidden(true);

        let visual = NSVisualEffectView::initWithFrame(NSVisualEffectView::alloc(mtm), zero);
        visual.setBlendingMode(NSVisualEffectBlendingMode::BehindWindow);
        visual.setState(NSVisualEffectState::Active);
        visual.setMaterial(NSVisualEffectMaterial::HUDWindow);
        visual.setHidden(true);
        host.addSubview(&visual);

        let glass = create_glass_effect_view(zero);
        if let Some(ref glass_view) = glass {
            glass_view.setHidden(true);
            host.addSubview(glass_view);
        }

        let subviews = content_view.subviews();
        if let Some(first) = subviews.firstObject() {
            content_view.addSubview_positioned_relativeTo(&host, NSWindowOrderingMode::Below, Some(&first));
        } else {
            content_view.addSubview(&host);
        }

        *borrow = Some(MountedGlass {
            window_number,
            host,
            visual,
            glass,
            cached_mask: None,
        });
        Some(())
    })
}

pub fn sync_window_ptr(
    ns_window_ptr: usize,
    spec: &NativeGlassSpec,
    mtm: MainThreadMarker,
) -> NativeGlassDecision {
    if ns_window_ptr == 0 {
        return NativeGlassDecision::CssFallback;
    }
    let window = unsafe { &*(ns_window_ptr as *const NSWindow) };
    sync_window_glass(window, spec, mtm)
}

pub fn sync_window_glass(window: &NSWindow, spec: &NativeGlassSpec, mtm: MainThreadMarker) -> NativeGlassDecision {
    let decision = choose_backend(spec, should_reduce_transparency(), has_glass_effect_view());
    if matches!(decision, NativeGlassDecision::Disabled | NativeGlassDecision::CssFallback) {
        MOUNTED.with(|slot| {
            if let Some(mounted) = slot.borrow().as_ref() {
                mounted.host.setHidden(true);
                mounted.visual.setHidden(true);
                if let Some(ref glass) = mounted.glass {
                    glass.setHidden(true);
                }
            }
        });
        return decision;
    }

    if ensure_mounted(window, mtm).is_none() {
        return NativeGlassDecision::CssFallback;
    }

    let Some(content_view) = window.contentView() else {
        return NativeGlassDecision::CssFallback;
    };
    let bounds = content_view.bounds();
    let content_h = if bounds.size.height > 1.0 { bounds.size.height } else { spec.stage_height };
    let effect_box = effect_box_in_view(spec, content_h, content_view.isFlipped());
    let host_frame = NSRect::new(
        NSPoint::new(effect_box.x, effect_box.y),
        NSSize::new(effect_box.width, effect_box.height),
    );
    let inner_frame = NSRect::new(
        NSPoint::new(0.0, 0.0),
        NSSize::new(effect_box.width, effect_box.height),
    );
    let backing_scale = window.backingScaleFactor();

    MOUNTED.with(|slot| {
        let mut borrow = slot.borrow_mut();
        let Some(mounted) = borrow.as_mut() else {
            return NativeGlassDecision::CssFallback;
        };
        mounted.host.setFrame(host_frame);
        mounted.host.setHidden(false);

        match decision {
            NativeGlassDecision::GlassEffectView => {
                if let Some(ref glass) = mounted.glass {
                    mounted.visual.setHidden(true);
                    glass.setFrame(inner_frame);
                    let radius = spec.bottom_radius.min(effect_box.width / 2.0).min(effect_box.height / 2.0);
                    configure_glass_effect_view(glass, radius, spec.light, spec.tint_rgba);
                    glass.setHidden(false);
                    return NativeGlassDecision::GlassEffectView;
                }
                apply_visual_effect(mounted, spec, inner_frame, effect_box, backing_scale)
            }
            NativeGlassDecision::VisualEffectView => {
                if let Some(ref glass) = mounted.glass {
                    glass.setHidden(true);
                }
                apply_visual_effect(mounted, spec, inner_frame, effect_box, backing_scale)
            }
            other => other,
        }
    })
}

fn apply_visual_effect(
    mounted: &mut MountedGlass,
    spec: &NativeGlassSpec,
    inner_frame: NSRect,
    effect_box: EffectBox,
    backing_scale: f64,
) -> NativeGlassDecision {
    mounted.visual.setFrame(inner_frame);
    mounted.visual.setMaterial(if spec.light {
        NSVisualEffectMaterial::Popover
    } else {
        NSVisualEffectMaterial::HUDWindow
    });
    apply_view_appearance(&mounted.visual, spec.light);
    let plan = build_mask_plan(spec, effect_box.width, effect_box.height, backing_scale);
    let needs_rebuild = mounted
        .cached_mask
        .as_ref()
        .is_none_or(|(cached_key, _)| *cached_key != plan.key);
    if needs_rebuild {
        if let Some(image) = build_mask_nsimage(&plan) {
            mounted.visual.setMaskImage(Some(&image));
            mounted.cached_mask = Some((plan.key, image));
        }
    }
    mounted.visual.setHidden(false);
    NativeGlassDecision::VisualEffectView
}

#[cfg(test)]
#[path = "island_glass_tests.rs"]
mod tests;
