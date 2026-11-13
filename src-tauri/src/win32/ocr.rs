use serde::Serialize;
use windows::{
    Graphics::Imaging::{BitmapAlphaMode, BitmapPixelFormat, SoftwareBitmap},
    Media::Ocr::{OcrEngine, OcrResult},
    Storage::Streams::DataWriter,
};

use super::com::WinRtApartment;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct OcrWord {
    pub(crate) text: String,
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) width: f32,
    pub(crate) height: f32,
}

pub(crate) fn recognize(width: u32, height: u32, rgba: &[u8]) -> Option<String> {
    with_result(width, height, rgba, |result| {
        let lines: Vec<String> = result
            .Lines()
            .ok()?
            .into_iter()
            .filter_map(|line| line.Text().ok())
            .map(|text| join_cjk(&text.to_string_lossy()))
            .filter(|line| !line.trim().is_empty())
            .collect();
        (!lines.is_empty()).then(|| lines.join("\n"))
    })
}

pub(crate) fn recognize_words(width: u32, height: u32, rgba: &[u8]) -> Option<Vec<Vec<OcrWord>>> {
    with_result(width, height, rgba, |result| {
        let lines = result
            .Lines()
            .ok()?
            .into_iter()
            .map(|line| {
                line.Words()
                    .map(|words| {
                        words
                            .into_iter()
                            .filter_map(|word| {
                                let text = word.Text().ok()?.to_string_lossy();
                                let rect = word.BoundingRect().ok()?;
                                Some(OcrWord { text, x: rect.X, y: rect.Y, width: rect.Width, height: rect.Height })
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default()
            })
            .filter(|words| !words.is_empty())
            .collect();
        Some(lines)
    })
}

fn with_result<T>(width: u32, height: u32, rgba: &[u8], read: impl FnOnce(&OcrResult) -> Option<T>) -> Option<T> {
    let _apartment = WinRtApartment::multithreaded().ok()?;
    let max = OcrEngine::MaxImageDimension().ok()?;
    if width == 0 || height == 0 || width > max || height > max || rgba.len() != (width * height * 4) as usize {
        return None;
    }
    let mut bgra = rgba.to_vec();
    for pixel in bgra.as_chunks_mut::<4>().0 {
        pixel.swap(0, 2);
    }
    let writer = DataWriter::new().ok()?;
    writer.WriteBytes(&bgra).ok()?;
    let buffer = writer.DetachBuffer().ok()?;
    let bitmap = SoftwareBitmap::CreateCopyWithAlphaFromBuffer(
        &buffer,
        BitmapPixelFormat::Bgra8,
        width as i32,
        height as i32,
        BitmapAlphaMode::Premultiplied,
    )
    .ok()?;
    let engine = OcrEngine::TryCreateFromUserProfileLanguages().ok()?;
    let result = engine.RecognizeAsync(&bitmap).ok()?.join().ok()?;
    read(&result)
}

fn is_cjk(c: char) -> bool {
    matches!(c, '\u{3000}'..='\u{303F}' | '\u{3040}'..='\u{30FF}' | '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}' | '\u{AC00}'..='\u{D7AF}' | '\u{FF00}'..='\u{FFEF}')
}

pub(crate) fn join_cjk(line: &str) -> String {
    let chars: Vec<char> = line.chars().collect();
    let mut joined = String::with_capacity(line.len());
    for (index, &c) in chars.iter().enumerate() {
        if c == ' ' {
            let before = index.checked_sub(1).and_then(|i| chars.get(i)).copied();
            let after = chars.get(index + 1).copied();
            if before.is_some_and(is_cjk) && after.is_some_and(is_cjk) {
                continue;
            }
        }
        joined.push(c);
    }
    joined
}

#[cfg(test)]
mod tests {
    use super::join_cjk;

    #[test]
    fn spaces_between_chinese_characters_go() {
        assert_eq!(join_cjk("你 好 世 界"), "你好世界");
        assert_eq!(join_cjk("发 票 Invoice 2026 年"), "发票 Invoice 2026 年");
        assert_eq!(join_cjk("hello world"), "hello world");
    }
}
