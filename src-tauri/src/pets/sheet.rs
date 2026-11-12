pub(super) const HEADER_BYTES: usize = 30;
pub(super) const MAX_SHEET_WIDTH: u32 = 3072;
const COLUMNS: f64 = 8.0;
const CELL_WIDTH: f64 = 192.0;
const CELL_HEIGHT: f64 = 208.0;
const ROW_COUNTS: [u32; 2] = [9, 11];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ImageHeader {
    pub mime: &'static str,
    pub width: u32,
    pub height: u32,
}

pub(super) fn image_header(bytes: &[u8]) -> Option<ImageHeader> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") && bytes.get(12..16)? == b"IHDR" {
        let width = u32::from_be_bytes(bytes.get(16..20)?.try_into().ok()?);
        let height = u32::from_be_bytes(bytes.get(20..24)?.try_into().ok()?);
        return Some(ImageHeader {
            mime: "image/png",
            width,
            height,
        });
    }
    if bytes.get(..4)? != b"RIFF" || bytes.get(8..12)? != b"WEBP" {
        return None;
    }
    let le24 = |at: usize| -> Option<u32> {
        let b = bytes.get(at..at + 3)?;
        Some(u32::from(b[0]) | u32::from(b[1]) << 8 | u32::from(b[2]) << 16)
    };
    let le16 = |at: usize| -> Option<u32> {
        let b = bytes.get(at..at + 2)?;
        Some(u32::from(b[0]) | u32::from(b[1]) << 8)
    };
    let (width, height) = match bytes.get(12..16)? {
        b"VP8X" => (le24(24)? + 1, le24(27)? + 1),
        b"VP8L" if *bytes.get(20)? == 0x2f => {
            let bits = u32::from_le_bytes(bytes.get(21..25)?.try_into().ok()?);
            ((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
        }
        b"VP8 " if bytes.get(23..26)? == [0x9d, 0x01, 0x2a] => {
            (le16(26)? & 0x3fff, le16(28)? & 0x3fff)
        }
        _ => return None,
    };
    Some(ImageHeader {
        mime: "image/webp",
        width,
        height,
    })
}

pub(super) fn sheet_rows(width: u32, height: u32) -> Option<u32> {
    if width == 0 || width > MAX_SHEET_WIDTH {
        return None;
    }
    let rows = f64::from(height) * COLUMNS * CELL_WIDTH / (f64::from(width) * CELL_HEIGHT);
    ROW_COUNTS
        .into_iter()
        .find(|count| (rows - f64::from(*count)).abs() < 0.02)
}
