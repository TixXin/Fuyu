use std::collections::HashMap;

use quick_xml::{
    events::{BytesStart, Event},
    Reader,
};

use super::found::{word_tag, FoundLyrics};

const INTERLUDE_GAP_MS: u64 = 4000;

#[derive(Debug, Default)]
struct Word {
    start: u64,
    end: u64,
    text: String,
}

#[derive(Debug, Default)]
struct Line {
    key: Option<String>,
    begin: Option<u64>,
    end: Option<u64>,
    plain: String,
    words: Vec<Word>,
    translation: String,
}

impl Line {
    fn start(&self) -> Option<u64> {
        self.begin.or_else(|| self.words.first().map(|word| word.start))
    }

    fn finish(&self) -> Option<u64> {
        self.words.iter().map(|word| word.end).max().max(self.end)
    }

    fn timed_text(&self) -> String {
        if self.words.iter().all(|word| word.text.trim().is_empty()) {
            return collapse(&self.plain).trim().to_string();
        }
        let mut timed = String::new();
        let mut end: Option<u64> = None;
        for word in &self.words {
            if end.is_some_and(|end| end < word.start) {
                timed.push_str(&word_tag(end.unwrap_or_default()));
            }
            timed.push_str(&word_tag(word.start));
            timed.push_str(&collapse(&word.text));
            end = Some(end.unwrap_or(word.end).max(word.end));
        }
        timed.push_str(&word_tag(end.unwrap_or_default()));
        timed.trim().to_string()
    }
}

#[derive(Debug, Clone, PartialEq)]
enum Frame {
    Line,
    Word(usize),
    Plain,
    Hidden,
    Translation,
    TranslationTable,
    TranslationText(String),
    Other,
}

fn collapse(text: &str) -> String {
    let mut out = String::new();
    for c in text.chars() {
        if !c.is_whitespace() {
            out.push(c);
        } else if !out.ends_with(' ') {
            out.push(' ');
        }
    }
    out
}

pub(super) fn time_ms(value: &str) -> Option<u64> {
    let value = value.trim();
    if let Some(ms) = value.strip_suffix("ms") {
        return ms.trim().parse::<f64>().ok().filter(|ms| *ms >= 0.0).map(|ms| ms.round() as u64);
    }
    let value = value.strip_suffix('s').unwrap_or(value);
    let mut parts = value.rsplit(':');
    let seconds: f64 = parts.next()?.parse().ok().filter(|seconds: &f64| *seconds >= 0.0)?;
    let mut total = seconds * 1000.0;
    for (index, part) in parts.enumerate() {
        let scale = if index == 0 { 60_000.0 } else { 3_600_000.0 };
        if index > 1 {
            return None;
        }
        total += part.parse::<u32>().ok()? as f64 * scale;
    }
    Some(total.round() as u64)
}

fn attribute(element: &BytesStart, name: &[u8]) -> Option<String> {
    element
        .attributes()
        .flatten()
        .find(|attribute| attribute.key.local_name().as_ref() == name)
        .and_then(|attribute| attribute.unescape_value().ok().map(|value| value.to_string()))
}

struct Parser {
    lines: Vec<Line>,
    table: HashMap<String, String>,
    stack: Vec<Frame>,
}

impl Parser {
    fn open(&mut self, element: &BytesStart) -> Frame {
        let name = element.local_name();
        let parent = self.stack.last().cloned().unwrap_or(Frame::Other);
        match name.as_ref() {
            _ if matches!(parent, Frame::Hidden | Frame::Translation) => parent,
            b"p" => {
                self.lines.push(Line {
                    key: attribute(element, b"key"),
                    begin: attribute(element, b"begin").and_then(|value| time_ms(&value)),
                    end: attribute(element, b"end").and_then(|value| time_ms(&value)),
                    ..Line::default()
                });
                Frame::Line
            }
            b"translations" => Frame::TranslationTable,
            b"translation" if parent == Frame::TranslationTable => Frame::TranslationTable,
            b"text" if parent == Frame::TranslationTable => match attribute(element, b"for") {
                Some(key) if !self.table.contains_key(&key) => {
                    self.table.insert(key.clone(), String::new());
                    Frame::TranslationText(key)
                }
                _ => Frame::Hidden,
            },
            b"span" if matches!(parent, Frame::Line | Frame::Word(_) | Frame::Plain) => {
                match attribute(element, b"role").as_deref() {
                    Some("x-translation") => Frame::Translation,
                    Some(_) => Frame::Hidden,
                    None => self.word(element).unwrap_or(match parent {
                        Frame::Word(index) => Frame::Word(index),
                        _ => Frame::Plain,
                    }),
                }
            }
            _ if matches!(parent, Frame::TranslationText(_)) => parent,
            _ => Frame::Other,
        }
    }

    fn word(&mut self, element: &BytesStart) -> Option<Frame> {
        let start = time_ms(&attribute(element, b"begin")?)?;
        let end = attribute(element, b"end").and_then(|value| time_ms(&value)).unwrap_or(start).max(start);
        let line = self.lines.last_mut()?;
        line.words.push(Word { start, end, text: String::new() });
        Some(Frame::Word(line.words.len() - 1))
    }

    fn text(&mut self, text: &str) {
        let Some(frame) = self.stack.last().cloned() else {
            return;
        };
        let layout = text.trim().is_empty() && text.contains('\n');
        match frame {
            Frame::Translation => {
                if let Some(line) = self.lines.last_mut() {
                    line.translation.push_str(text);
                }
            }
            Frame::TranslationText(key) => self.table.entry(key).or_default().push_str(text),
            Frame::Word(index) => {
                if let Some(word) = self.lines.last_mut().and_then(|line| line.words.get_mut(index)) {
                    word.text.push_str(text);
                }
            }
            Frame::Line | Frame::Plain if !layout => {
                if let Some(line) = self.lines.last_mut() {
                    match line.words.last_mut() {
                        Some(word) => word.text.push_str(text),
                        None => line.plain.push_str(text),
                    }
                }
            }
            _ => {}
        }
    }
}

fn reference(name: &str) -> Option<String> {
    let known = match name {
        "lt" => "<",
        "gt" => ">",
        "amp" => "&",
        "quot" => "\"",
        "apos" => "'",
        _ => "",
    };
    if !known.is_empty() {
        return Some(known.to_string());
    }
    let code = name.strip_prefix('#')?;
    let value = code.strip_prefix('x').map_or_else(|| code.parse().ok(), |hex| u32::from_str_radix(hex, 16).ok());
    value.and_then(char::from_u32).map(String::from)
}

fn parse(ttml: &str) -> (Vec<Line>, HashMap<String, String>) {
    let mut reader = Reader::from_str(ttml);
    let mut parser = Parser { lines: Vec::new(), table: HashMap::new(), stack: Vec::new() };
    loop {
        match reader.read_event() {
            Ok(Event::Eof) | Err(_) => break,
            Ok(Event::Start(element)) => {
                let frame = parser.open(&element);
                parser.stack.push(frame);
            }
            Ok(Event::Empty(element)) => {
                parser.open(&element);
            }
            Ok(Event::End(_)) => {
                parser.stack.pop();
            }
            Ok(Event::Text(content)) => parser.text(&content.xml_content().unwrap_or_default()),
            Ok(Event::CData(content)) => parser.text(&String::from_utf8_lossy(&content)),
            Ok(Event::GeneralRef(name)) => {
                if let Some(text) = reference(&String::from_utf8_lossy(&name)) {
                    parser.text(&text);
                }
            }
            Ok(_) => {}
        }
    }
    (parser.lines, parser.table)
}

fn timestamp(ms: u64) -> String {
    format!("[{:02}:{:02}.{:02}]", ms / 60_000, ms / 1000 % 60, ms % 1000 / 10)
}

pub(super) fn to_lyrics(ttml: &str) -> Option<FoundLyrics> {
    let (lines, table) = parse(ttml);
    let mut timed: Vec<(u64, &Line)> = lines.iter().filter_map(|line| Some((line.start()?, line))).collect();
    timed.sort_by_key(|(start, _)| *start);
    let mut lrc = String::new();
    let mut translated = String::new();
    for (index, (start, line)) in timed.iter().enumerate() {
        let text = line.timed_text();
        if text.is_empty() {
            continue;
        }
        lrc.push_str(&format!("{}{text}\n", timestamp(*start)));
        let inline = collapse(&line.translation).trim().to_string();
        let from_table = line.key.as_ref().and_then(|key| table.get(key)).map(|text| collapse(text).trim().to_string());
        if let Some(translation) = Some(inline).filter(|text| !text.is_empty()).or(from_table).filter(|text| !text.is_empty()) {
            translated.push_str(&format!("{}{translation}\n", timestamp(*start)));
        }
        let next = timed.get(index + 1).map(|(next, _)| *next);
        if let Some(end) = line.finish().filter(|end| next.is_none_or(|next| next > end + INTERLUDE_GAP_MS)) {
            lrc.push_str(&format!("{}\n", timestamp(end)));
        }
    }
    let sung = lrc.lines().any(|line| line.len() > timestamp(0).len());
    sung.then(|| FoundLyrics { lrc, translation: (!translated.is_empty()).then_some(translated) })
}

#[cfg(test)]
mod tests {
    use super::*;

    const AMLL: &str = r#"<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body dur="03:30.361"><div begin="00:00.686" end="00:20.000"><p begin="00:00.686" end="00:03.110" ttm:agent="v1" itunes:key="L1"><span begin="00:00.686" end="00:01.020">Couldn&apos;t</span><span begin="00:01.020" end="00:01.193"> beat</span> <span begin="00:01.500" end="00:02.000">her</span><span ttm:role="x-translation" xml:lang="zh-CN">她露出笑容</span><span ttm:role="x-roman">roma</span><span ttm:role="x-bg"><span begin="00:02.000" end="00:02.500">(ooh)</span></span></p><p begin="00:03.561" end="00:04.970" ttm:agent="v2" itunes:key="L2"><span begin="00:03.561" end="00:03.886">秘</span><span begin="00:03.886" end="00:04.970">密</span></p><p begin="00:12.000" end="00:13.000">Line timed only</p></div></body></tt>"#;

    #[test]
    fn word_timed_lines_become_karaoke_lrc_with_translations() {
        let found = to_lyrics(AMLL).unwrap();
        assert_eq!(
            found.lrc,
            "[00:00.68]<00:00.68>Couldn't<00:01.02> beat <00:01.19><00:01.50>her<00:02.00>\n\
             [00:03.56]<00:03.56>秘<00:03.88>密<00:04.97>\n\
             [00:04.97]\n\
             [00:12.00]Line timed only\n\
             [00:13.00]\n"
        );
        assert_eq!(found.translation.as_deref(), Some("[00:00.68]她露出笑容\n"));
    }

    #[test]
    fn apple_head_translations_and_pretty_printing_are_read() {
        let apple = r#"<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word">
  <head>
    <metadata>
      <iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
        <translations>
          <translation type="replacement" xml:lang="zh-Hans">
            <text for="L1">你好 &amp; 世界</text>
          </translation>
          <translation type="replacement" xml:lang="ja">
            <text for="L1">こんにちは</text>
          </translation>
        </translations>
        <transliterations><transliteration><text for="L1">ignored</text></transliteration></transliterations>
      </iTunesMetadata>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="1:02.5" end="1:04" itunes:key="L1">
        <span begin="62.5s" end="63.0s">Hello</span>
        <span begin="63.0" end="1:04.000">world</span>
      </p>
      <p>untimed</p>
    </div>
  </body>
</tt>"#;
        let found = to_lyrics(apple).unwrap();
        assert_eq!(found.lrc, "[01:02.50]<01:02.50>Hello<01:03.00>world<01:04.00>\n[01:04.00]\n");
        assert_eq!(found.translation.as_deref(), Some("[01:02.50]你好 & 世界\n"));
    }

    #[test]
    fn times_and_broken_files() {
        assert_eq!(time_ms("00:01.020"), Some(1020));
        assert_eq!(time_ms("1:02:03.5"), Some(3_723_500));
        assert_eq!(time_ms("83.4s"), Some(83_400));
        assert_eq!(time_ms("250ms"), Some(250));
        assert_eq!(time_ms("1:2:3:4"), None);
        assert_eq!(time_ms("abc"), None);
        assert_eq!(to_lyrics("<tt><body><div><p begin=\"00:01.000\"></p><p>no time</p></div></body></tt>"), None);
        assert_eq!(to_lyrics("not xml at all"), None);
        assert!(to_lyrics("<tt><body><div><p begin=\"00:01.000\">a long enough line<span").is_some());
    }
}
