use objc2::{msg_send, rc::Retained, AllocAnyThread};
use objc2_core_foundation::{CFData, CFRetained, CGRect};
use objc2_core_graphics::{CGBitmapInfo, CGColorRenderingIntent, CGColorSpace, CGDataProvider, CGImage, CGImageAlphaInfo};
use objc2_foundation::{NSArray, NSDictionary, NSError, NSRange, NSString};
use objc2_vision::{
    VNImageRequestHandler, VNRecognizeTextRequest, VNRecognizedText, VNRecognizedTextObservation, VNRectangleObservation, VNRequest,
    VNRequestTextRecognitionLevel,
};
use serde::Serialize;

const MAX_SIDE: u32 = 16_384;
const LANGUAGES: [&str; 4] = ["zh-Hans", "zh-Hant", "en-US", "ja-JP"];

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct OcrWord {
    pub(crate) text: String,
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) width: f32,
    pub(crate) height: f32,
}

struct Line {
    text: Retained<VNRecognizedText>,
    string: String,
    bounds: CGRect,
}

pub(crate) fn recognize(width: u32, height: u32, rgba: &[u8]) -> Option<String> {
    let lines: Vec<String> = read_lines(width, height, rgba)?
        .into_iter()
        .map(|line| line.string)
        .filter(|line| !line.trim().is_empty())
        .collect();
    (!lines.is_empty()).then(|| lines.join("\n"))
}

pub(crate) fn recognize_words(width: u32, height: u32, rgba: &[u8]) -> Option<Vec<Vec<OcrWord>>> {
    let size = (f64::from(width), f64::from(height));
    let lines = read_lines(width, height, rgba)?
        .into_iter()
        .map(|line| {
            word_spans(&line.string)
                .into_iter()
                .filter_map(|(text, start, length)| {
                    let rect = word_box(&line.text, start, length).unwrap_or(line.bounds);
                    Some(to_pixels(text, rect, size)).filter(|word| word.width > 0.0 && word.height > 0.0)
                })
                .collect::<Vec<_>>()
        })
        .filter(|words| !words.is_empty())
        .collect();
    Some(lines)
}

fn is_cjk(c: char) -> bool {
    matches!(c, '\u{3000}'..='\u{303F}' | '\u{3040}'..='\u{30FF}' | '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}' | '\u{AC00}'..='\u{D7AF}' | '\u{FF00}'..='\u{FFEF}')
}

pub(crate) fn word_spans(line: &str) -> Vec<(String, usize, usize)> {
    let mut spans: Vec<(String, usize, usize)> = Vec::new();
    let mut open = false;
    let mut at = 0;
    for c in line.chars() {
        let width = c.len_utf16();
        if c.is_whitespace() {
            open = false;
        } else if is_cjk(c) {
            spans.push((c.to_string(), at, width));
            open = false;
        } else if let Some(last) = spans.last_mut().filter(|_| open) {
            last.0.push(c);
            last.2 += width;
        } else {
            spans.push((c.to_string(), at, width));
            open = true;
        }
        at += width;
    }
    spans
}

fn to_pixels(text: String, rect: CGRect, (width, height): (f64, f64)) -> OcrWord {
    OcrWord {
        text,
        x: (rect.origin.x * width) as f32,
        y: ((1.0 - rect.origin.y - rect.size.height) * height) as f32,
        width: (rect.size.width * width) as f32,
        height: (rect.size.height * height) as f32,
    }
}

fn word_box(text: &VNRecognizedText, start: usize, length: usize) -> Option<CGRect> {
    let range = NSRange::new(start, length);
    let result: Result<Retained<VNRectangleObservation>, Retained<NSError>> = unsafe { msg_send![text, boundingBoxForRange: range, error: _] };
    result.ok().map(|observation| unsafe { observation.boundingBox() })
}

fn read_lines(width: u32, height: u32, rgba: &[u8]) -> Option<Vec<Line>> {
    if width == 0 || height == 0 || width > MAX_SIDE || height > MAX_SIDE || rgba.len() != width as usize * height as usize * 4 {
        return None;
    }
    let image = to_image(width, height, rgba)?;
    let request = VNRecognizeTextRequest::new();
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    request.setUsesLanguageCorrection(true);
    let languages: Vec<Retained<NSString>> = LANGUAGES.iter().map(|language| NSString::from_str(language)).collect();
    request.setRecognitionLanguages(&NSArray::from_retained_slice(&languages));
    let handler = unsafe { VNImageRequestHandler::initWithCGImage_options(VNImageRequestHandler::alloc(), &image, &NSDictionary::new()) };
    let requests: Retained<NSArray<VNRequest>> = NSArray::from_slice(&[&**request]);
    handler.performRequests_error(&requests).ok()?;
    let observations: Retained<NSArray<VNRecognizedTextObservation>> = request.results()?;
    let mut lines: Vec<Line> = observations
        .iter()
        .filter_map(|observation| {
            let text = observation.topCandidates(1).firstObject()?;
            let string = text.string().to_string();
            Some(Line { text, string, bounds: unsafe { observation.boundingBox() } })
        })
        .collect();
    lines.sort_by(|a, b| {
        let top = |line: &Line| -(line.bounds.origin.y + line.bounds.size.height);
        top(a).total_cmp(&top(b)).then(a.bounds.origin.x.total_cmp(&b.bounds.origin.x))
    });
    Some(lines)
}

fn to_image(width: u32, height: u32, rgba: &[u8]) -> Option<CFRetained<CGImage>> {
    let data = CFData::from_bytes(rgba);
    let provider = CGDataProvider::with_cf_data(Some(&data))?;
    let space = CGColorSpace::new_device_rgb()?;
    unsafe {
        CGImage::new(
            width as usize,
            height as usize,
            8,
            32,
            width as usize * 4,
            Some(&space),
            CGBitmapInfo(CGImageAlphaInfo::NoneSkipLast.0),
            Some(&provider),
            std::ptr::null(),
            false,
            CGColorRenderingIntent::RenderingIntentDefault,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::word_spans;

    #[test]
    fn chinese_characters_are_words_of_their_own() {
        let spans = word_spans("打开 Fuyu 设置");
        let words: Vec<&str> = spans.iter().map(|(text, _, _)| text.as_str()).collect();
        assert_eq!(words, ["打", "开", "Fuyu", "设", "置"]);
        assert_eq!(spans[2].1, 3);
        assert_eq!(spans[2].2, 4);
    }

    #[test]
    fn utf16_offsets_count_surrogate_pairs() {
        let spans = word_spans("😀 ok");
        assert_eq!(spans, vec![("😀".to_string(), 0, 2), ("ok".to_string(), 3, 2)]);
    }
}
