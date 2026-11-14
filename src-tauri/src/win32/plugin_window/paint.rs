use windows::{
    core::w,
    Win32::{
        Foundation::{COLORREF, HWND, POINT, RECT},
        Graphics::Gdi::{
            BeginPaint, CreateFontW, CreateSolidBrush, DeleteObject, DrawTextW, EndPaint, FillRect, SelectObject, SetBkMode, SetTextColor,
            CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, DT_CENTER, DT_END_ELLIPSIS, DT_LEFT, DT_NOPREFIX, DT_SINGLELINE,
            DT_VCENTER, FW_NORMAL, FW_SEMIBOLD, HGDIOBJ, OUT_DEFAULT_PRECIS, PAINTSTRUCT, TRANSPARENT,
        },
        UI::WindowsAndMessaging::GetClientRect,
    },
};

use super::Look;

pub(super) fn caption_height(scale: f64) -> i32 {
    (32.0 * scale).round() as i32
}

fn close_button(client: RECT, scale: f64) -> RECT {
    let size = caption_height(scale);
    RECT { left: client.right - size, top: 0, right: client.right, bottom: size }
}

pub(super) fn in_close_button(client: RECT, point: POINT, scale: f64) -> bool {
    let button = close_button(client, scale);
    point.x >= button.left && point.x < button.right && point.y >= button.top && point.y < button.bottom
}

fn color([red, green, blue]: [u8; 3]) -> COLORREF {
    COLORREF(u32::from(red) | (u32::from(green) << 8) | (u32::from(blue) << 16))
}

fn draw_text(hdc: windows::Win32::Graphics::Gdi::HDC, text: &str, mut rect: RECT, height: i32, weight: i32, format: windows::Win32::Graphics::Gdi::DRAW_TEXT_FORMAT) {
    let mut text: Vec<u16> = text.encode_utf16().collect();
    if text.is_empty() {
        return;
    }
    unsafe {
        let font = CreateFontW(
            -height,
            0,
            0,
            0,
            weight,
            0,
            0,
            0,
            DEFAULT_CHARSET,
            OUT_DEFAULT_PRECIS,
            CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY,
            0,
            w!("Segoe UI"),
        );
        let previous = SelectObject(hdc, HGDIOBJ(font.0));
        DrawTextW(hdc, &mut text, &mut rect, format | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX);
        SelectObject(hdc, previous);
        let _ = DeleteObject(HGDIOBJ(font.0));
    }
}

pub(super) fn paint(hwnd: HWND, look: &Look, scale: f64) {
    let mut paint = PAINTSTRUCT::default();
    let hdc = unsafe { BeginPaint(hwnd, &mut paint) };
    if let Some(caption) = &look.caption {
        let mut client = RECT::default();
        unsafe {
            let _ = GetClientRect(hwnd, &mut client);
            let brush = CreateSolidBrush(color(caption.background));
            FillRect(hdc, &client, brush);
            let _ = DeleteObject(HGDIOBJ(brush.0));
            SetBkMode(hdc, TRANSPARENT);
            SetTextColor(hdc, color(caption.foreground));
        }
        let height = caption_height(scale);
        let padding = (12.0 * scale).round() as i32;
        let button = close_button(client, scale);
        let title = RECT { left: padding, top: 0, right: button.left, bottom: height };
        draw_text(hdc, &caption.text, title, (12.0 * scale).round() as i32, FW_SEMIBOLD.0 as i32, DT_LEFT | DT_END_ELLIPSIS);
        draw_text(hdc, "\u{00D7}", button, (18.0 * scale).round() as i32, FW_NORMAL.0 as i32, DT_CENTER);
    }
    let _ = unsafe { EndPaint(hwnd, &paint) };
}
