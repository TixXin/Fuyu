use std::{ffi::c_void, mem::size_of};

use windows::{
    core::PCWSTR,
    Win32::{
        Graphics::Gdi::{
            CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
            BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
        },
        UI::{
            Shell::ExtractIconExW,
            WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO},
        },
    },
};

pub(crate) struct IconPixels {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) rgba: Vec<u8>,
}

struct IconHandle(HICON);

impl Drop for IconHandle {
    fn drop(&mut self) {
        let _ = unsafe { DestroyIcon(self.0) };
    }
}

struct BitmapHandle(HBITMAP);

impl Drop for BitmapHandle {
    fn drop(&mut self) {
        if !self.0.is_invalid() {
            let _ = unsafe { DeleteObject(HGDIOBJ(self.0 .0)) };
        }
    }
}

pub(crate) fn exe_icon(path: &str) -> Option<IconPixels> {
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    let mut large = HICON::default();
    let count = unsafe { ExtractIconExW(PCWSTR(wide.as_ptr()), 0, Some(&mut large), None, 1) };
    if count == 0 || large.is_invalid() {
        return None;
    }
    icon_pixels(&IconHandle(large))
}

fn icon_pixels(icon: &IconHandle) -> Option<IconPixels> {
    let mut info = ICONINFO::default();
    unsafe { GetIconInfo(icon.0, &mut info) }.ok()?;
    let color = BitmapHandle(info.hbmColor);
    let mask = BitmapHandle(info.hbmMask);
    if color.0.is_invalid() {
        return None;
    }

    let mut bitmap = BITMAP::default();
    let written = unsafe {
        GetObjectW(
            HGDIOBJ(color.0 .0),
            size_of::<BITMAP>() as i32,
            Some(&mut bitmap as *mut BITMAP as *mut c_void),
        )
    };
    let (width, height) = (u32::try_from(bitmap.bmWidth).ok()?, u32::try_from(bitmap.bmHeight).ok()?);
    if written == 0 || width == 0 || height == 0 || width > 256 || height > 256 {
        return None;
    }

    let mut colors = read_bgra(&color, width, height)?;
    if colors.as_chunks::<4>().0.iter().all(|pixel| pixel[3] == 0) {
        let mask_pixels = read_bgra(&mask, width, height)?;
        for (pixel, masked) in colors.as_chunks_mut::<4>().0.iter_mut().zip(mask_pixels.as_chunks::<4>().0) {
            pixel[3] = if masked[0] == 0 { 255 } else { 0 };
        }
    }
    for pixel in colors.as_chunks_mut::<4>().0 {
        pixel.swap(0, 2);
    }
    Some(IconPixels { width, height, rgba: colors })
}

fn read_bgra(bitmap: &BitmapHandle, width: u32, height: u32) -> Option<Vec<u8>> {
    if bitmap.0.is_invalid() {
        return None;
    }
    let mut pixels = vec![0u8; width as usize * height as usize * 4];
    let mut header = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    let dc = unsafe { CreateCompatibleDC(None) };
    if dc.is_invalid() {
        return None;
    }
    let rows = unsafe {
        GetDIBits(
            dc,
            bitmap.0,
            0,
            height,
            Some(pixels.as_mut_ptr() as *mut c_void),
            &mut header,
            DIB_RGB_COLORS,
        )
    };
    let _ = unsafe { DeleteDC(dc) };
    (rows == height as i32).then_some(pixels)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn executables_with_an_icon_give_square_pixels_and_missing_files_none() {
        let explorer = std::env::var("WINDIR").map(|dir| format!(r"{dir}\explorer.exe")).unwrap_or_default();
        let icon = exe_icon(&explorer).expect("explorer.exe has an icon");
        assert_eq!(icon.width, icon.height);
        assert_eq!(icon.rgba.len(), (icon.width * icon.height * 4) as usize);
        assert!(icon.rgba.as_chunks::<4>().0.iter().any(|pixel| pixel[3] > 0));
        assert!(exe_icon(r"C:\does\not\exist.exe").is_none());
    }
}
