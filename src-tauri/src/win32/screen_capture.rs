//! The pixels of a rectangle of the desktop (GDI BitBlt from the screen DC), for screenshots.
//! Coordinates are physical pixels on the virtual screen; the process is per-monitor DPI aware
//! (tao sets that up), so they match what `available_monitors` reports.

use std::{ffi::c_void, mem::size_of};

use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
    ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT, DIB_RGB_COLORS, HBITMAP,
    HDC, HGDIOBJ, SRCCOPY,
};

/// Releases the screen DC from GetDC(None).
struct ScreenDc(HDC);

impl Drop for ScreenDc {
    fn drop(&mut self) {
        // SAFETY: the DC came from GetDC(None) and is released exactly once here.
        let _ = unsafe { ReleaseDC(None, self.0) };
    }
}

/// Deletes a memory DC from CreateCompatibleDC.
struct MemoryDc(HDC);

impl Drop for MemoryDc {
    fn drop(&mut self) {
        // SAFETY: the DC came from CreateCompatibleDC, is owned only here and deleted once.
        let _ = unsafe { DeleteDC(self.0) };
    }
}

/// Deletes a bitmap from CreateCompatibleBitmap; it must not be selected into a DC by then.
struct Bitmap(HBITMAP);

impl Drop for Bitmap {
    fn drop(&mut self) {
        // SAFETY: the bitmap came from CreateCompatibleBitmap and is deleted once, after it was
        // selected out of the memory DC.
        let _ = unsafe { DeleteObject(HGDIOBJ(self.0 .0)) };
    }
}

/// The `width` × `height` pixels at (`x`, `y`) on the virtual screen as RGBA, rows top to bottom,
/// fully opaque. `None` when the screen cannot be read (a locked or secure desktop) or the size
/// is zero.
pub(crate) fn capture(x: i32, y: i32, width: u32, height: u32) -> Option<Vec<u8>> {
    let (w, h) = (i32::try_from(width).ok()?, i32::try_from(height).ok()?);
    if w == 0 || h == 0 {
        return None;
    }
    // SAFETY: GetDC(None) returns the DC of the whole screen; ScreenDc releases it.
    let screen = ScreenDc(unsafe { GetDC(None) });
    if screen.0.is_invalid() {
        return None;
    }
    // SAFETY: a memory DC compatible with the live screen DC; MemoryDc deletes it.
    let memory = MemoryDc(unsafe { CreateCompatibleDC(Some(screen.0)) });
    if memory.0.is_invalid() {
        return None;
    }
    // SAFETY: a bitmap of the requested size compatible with the live screen DC; Bitmap deletes it.
    let bitmap = Bitmap(unsafe { CreateCompatibleBitmap(screen.0, w, h) });
    if bitmap.0.is_invalid() {
        return None;
    }
    // SAFETY: both DCs and the bitmap are live; the previous object is selected back below so
    // the bitmap is free again before GetDIBits reads it and Bitmap deletes it.
    let copied = unsafe {
        let previous = SelectObject(memory.0, HGDIOBJ(bitmap.0 .0));
        // CAPTUREBLT includes layered (translucent) windows, as the screen shows them.
        let copied = BitBlt(memory.0, 0, 0, w, h, Some(screen.0), x, y, SRCCOPY | CAPTUREBLT);
        SelectObject(memory.0, previous);
        copied
    };
    copied.ok()?;

    let mut pixels = vec![0u8; width as usize * height as usize * 4];
    let mut header = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w,
            // Negative height: top-down rows.
            biHeight: -h,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    // SAFETY: the memory DC and the bitmap are live and the bitmap is not selected into any DC;
    // `pixels` holds `height` rows of `width` 32-bit pixels, as `header` describes.
    let rows = unsafe {
        GetDIBits(
            memory.0,
            bitmap.0,
            0,
            height,
            Some(pixels.as_mut_ptr() as *mut c_void),
            &mut header,
            DIB_RGB_COLORS,
        )
    };
    if rows != h {
        return None;
    }
    bgra_to_opaque_rgba(&mut pixels);
    Some(pixels)
}

/// GDI hands back BGRA with an undefined alpha; the screen is opaque.
pub(crate) fn bgra_to_opaque_rgba(pixels: &mut [u8]) {
    for pixel in pixels.as_chunks_mut::<4>().0 {
        pixel.swap(0, 2);
        pixel[3] = 255;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bgra_becomes_opaque_rgba() {
        let mut pixels = vec![1, 2, 3, 0, 10, 20, 30, 7];
        bgra_to_opaque_rgba(&mut pixels);
        assert_eq!(pixels, [3, 2, 1, 255, 30, 20, 10, 255]);
    }

    #[test]
    fn an_empty_rectangle_is_none() {
        assert!(capture(0, 0, 0, 10).is_none());
        assert!(capture(0, 0, 10, 0).is_none());
    }
}
