use std::io::Read;

use flate2::read::ZlibDecoder;
use quick_xml::{events::Event, Reader};

use super::krc::{KrcLine, KrcWord};

const MAX_HEX_BYTES: usize = 2 * 1024 * 1024;
const MAX_TEXT_BYTES: u64 = 1024 * 1024;
const KEYS: [(&[u8; 8], bool); 3] = [(b"!@#)(NHL", true), (b"123ZXC!@", false), (b"!@#)(*$%", true)];

const IP: [u8; 64] = [
    58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
    57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
];
const FP: [u8; 64] = [
    40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
    36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
];
const PC1: [u8; 56] = [
    57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39,
    31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
];
const PC2: [u8; 48] = [
    14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51,
    45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
];
const E: [u8; 48] = [
    32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23,
    24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
];
const P: [u8; 32] = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
const SHIFTS: [u32; 16] = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const S: [[[u8; 16]; 4]; 8] = [
    [
        [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
        [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
        [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
        [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
    ],
    [
        [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
        [3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10, 6, 9, 11, 5],
        [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
        [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
    ],
    [
        [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
        [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
        [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
        [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
    ],
    [
        [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
        [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
        [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
        [3, 15, 0, 6, 10, 10, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
    ],
    [
        [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
        [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
        [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
        [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
    ],
    [
        [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
        [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
        [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
        [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
    ],
    [
        [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
        [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
        [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
        [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
    ],
    [
        [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
        [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
        [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
        [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
    ],
];

fn permute(input: u64, width: u32, table: &[u8]) -> u64 {
    table.iter().fold(0, |out, &position| (out << 1) | ((input >> (width - u32::from(position))) & 1))
}

fn load(bytes: [u8; 8]) -> u64 {
    let [a, b, c, d, e, f, g, h] = bytes;
    u64::from_be_bytes([d, c, b, a, h, g, f, e])
}

fn subkeys(key: &[u8; 8], decrypt: bool) -> [u64; 16] {
    let chosen = permute(load(*key), 64, &PC1);
    let (mut c, mut d) = (chosen >> 28, chosen & 0x0fff_ffff);
    let mut keys = [0; 16];
    for (round, shift) in SHIFTS.into_iter().enumerate() {
        c = ((c << shift) | (c >> (28 - shift))) & 0x0fff_ffff;
        d = ((d << shift) | (d >> (28 - shift))) & 0x0fff_ffff;
        let joined = (c << 28) | d;
        let key = PC2.iter().fold(0, |out, &position| {
            let bit = match u32::from(position) {
                position @ ..=28 => (joined >> (56 - position)) & 1,
                56 => 0,
                position => (joined >> (55 - position)) & 1,
            };
            (out << 1) | bit
        });
        keys[if decrypt { 15 - round } else { round }] = key;
    }
    keys
}

fn feistel(right: u32, key: u64) -> u32 {
    let mixed = permute(u64::from(right), 32, &E) ^ key;
    let substituted = S.iter().enumerate().fold(0u64, |out, (index, sbox)| {
        let six = (mixed >> (42 - 6 * index)) & 0x3f;
        let row = (((six >> 4) & 2) | (six & 1)) as usize;
        let column = ((six >> 1) & 0xf) as usize;
        (out << 4) | u64::from(sbox[row][column])
    });
    permute(substituted, 32, &P) as u32
}

fn crypt_block(block: u64, keys: &[u64; 16]) -> u64 {
    let permuted = permute(block, 64, &IP);
    let (mut left, mut right) = ((permuted >> 32) as u32, permuted as u32);
    for &key in keys {
        (left, right) = (right, left ^ feistel(right, key));
    }
    permute((u64::from(right) << 32) | u64::from(left), 64, &FP)
}

fn from_hex(hex: &str) -> Option<Vec<u8>> {
    let hex = hex.trim().as_bytes();
    if hex.is_empty() || hex.len() > MAX_HEX_BYTES || !hex.len().is_multiple_of(16) {
        return None;
    }
    let digit = |byte: u8| char::from(byte).to_digit(16);
    hex.chunks(2).map(|pair| Some((digit(pair[0])? * 16 + digit(pair[1])?) as u8)).collect()
}

pub(super) fn decrypt(hex: &str) -> Option<String> {
    let bytes = from_hex(hex)?;
    let schedules = KEYS.map(|(key, decrypt)| subkeys(key, decrypt));
    let mut plain = Vec::with_capacity(bytes.len());
    for chunk in bytes.chunks(8) {
        let mut block = load(chunk.try_into().ok()?);
        for keys in &schedules {
            block = crypt_block(block, keys);
        }
        plain.extend_from_slice(&load(block.to_be_bytes()).to_be_bytes());
    }
    let mut text = String::new();
    ZlibDecoder::new(plain.as_slice()).take(MAX_TEXT_BYTES).read_to_string(&mut text).ok()?;
    Some(text.trim_start_matches('\u{feff}').to_string())
}

fn lyric_content(xml: &str) -> Option<String> {
    let mut reader = Reader::from_str(xml);
    loop {
        match reader.read_event().ok()? {
            Event::Start(element) | Event::Empty(element) => {
                let content = element
                    .attributes()
                    .flatten()
                    .find(|attribute| attribute.key.local_name().as_ref() == b"LyricContent")
                    .and_then(|attribute| attribute.unescape_value().ok().map(|value| value.to_string()));
                if content.is_some() {
                    return content;
                }
            }
            Event::Eof => return None,
            _ => {}
        }
    }
}

fn word_timing(text: &str) -> Option<(u64, u64)> {
    let (start, duration) = text.split_once(',')?;
    Some((start.trim().parse().ok()?, duration.trim().parse().ok()?))
}

fn line(text: &str) -> Option<KrcLine> {
    let (timing, mut rest) = text.trim().strip_prefix('[')?.split_once(']')?;
    let (start_ms, _) = word_timing(timing)?;
    let mut words = Vec::new();
    let mut pending = String::new();
    while let Some(open) = rest.find('(') {
        let timed = rest[open + 1..].find(')').and_then(|close| Some((close, word_timing(&rest[open + 1..open + 1 + close])?)));
        match timed {
            Some((close, (start, duration_ms))) => {
                pending.push_str(&rest[..open]);
                let offset_ms = start.saturating_sub(start_ms);
                words.push(KrcWord { offset_ms, duration_ms, text: std::mem::take(&mut pending) });
                rest = &rest[open + close + 2..];
            }
            None => {
                pending.push_str(&rest[..=open]);
                rest = &rest[open + 1..];
            }
        }
    }
    pending.push_str(rest);
    let mut text: String = words.iter().map(|word| word.text.as_str()).collect();
    text.push_str(&pending);
    Some(KrcLine { start_ms, text: text.trim().to_string(), words })
}

pub(super) fn lines(qrc: &str) -> Vec<KrcLine> {
    let content = lyric_content(qrc).unwrap_or_else(|| qrc.to_string());
    content.lines().filter_map(line).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_qq_cipher_decrypts_a_published_test_vector() {
        let hex = "32dabb4c5e9846fa6f3a98a26231e62faa2f92527b4b66399aceac954ccbb7bce2d996df595836a57589df8de3f46727";
        assert_eq!(decrypt(hex).as_deref(), Some("[00:01.23]第一行\n[00:05.50]第二行"));
        for broken in ["", "00", "zzzzzzzzzzzzzzzz", "0000000000000000"] {
            assert_eq!(decrypt(broken), None);
        }
    }

    #[test]
    fn qrc_lines_become_timed_text_with_their_word_times() {
        let xml = "<?xml version=\"1.0\"?><QrcInfos><LyricInfo><Lyric_1 LyricType=\"1\" LyricContent=\"[ti:Song]\n[1000,1500]你(1000,400)好 &amp; (1400,300)say (hi)(1700,800)\n[3000,500]\n\"/></LyricInfo></QrcInfos>";
        let parsed = lines(xml);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].text, "你好 & say (hi)");
        assert_eq!(parsed[0].timed_text(), "<00:01.00>你<00:01.40>好 & <00:01.70>say (hi)<00:02.50>");
        assert_eq!(parsed[1].start_ms, 3000);
        assert_eq!(parsed[1].timed_text(), "");
        assert_eq!(lines("[500,100]a(500,100)")[0].timed_text(), "<00:00.50>a<00:00.60>");
    }
}
