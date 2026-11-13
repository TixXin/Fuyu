use objc2_app_kit::{NSColor, NSColorSpace};

pub(crate) fn accent_color() -> Option<String> {
    let color = NSColor::controlAccentColor().colorUsingColorSpace(&NSColorSpace::sRGBColorSpace())?;
    let channel = |value: f64| (value.clamp(0.0, 1.0) * 255.0).round() as u8;
    Some(format!("#{:02x}{:02x}{:02x}", channel(color.redComponent()), channel(color.greenComponent()), channel(color.blueComponent())))
}
