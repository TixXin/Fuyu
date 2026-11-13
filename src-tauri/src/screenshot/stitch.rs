const EDGE: u32 = 20;
const DETAIL: i32 = 10;
const MIN_MATCHES: usize = 6;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Row {
    hash: u64,
    detail: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Step {
    Added(u32),
    Unchanged,
    Lost,
}

pub(crate) struct Stitcher {
    width: u32,
    height: u32,
    fixed: Option<(u32, u32)>,
    rows: Vec<Row>,
    last: Vec<u8>,
    body: Vec<u8>,
}

fn rows(rgba: &[u8], width: u32, height: u32) -> Vec<Row> {
    let skip = if width > EDGE * 4 { EDGE } else { 0 };
    let row_bytes = width as usize * 4;
    (0..height as usize)
        .map(|y| {
            let line = &rgba[y * row_bytes + skip as usize * 4..(y + 1) * row_bytes - skip as usize * 4];
            let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
            for byte in line {
                hash = (hash ^ u64::from(*byte)).wrapping_mul(0x0100_0000_01b3);
            }
            let first = &line[..4.min(line.len())];
            let detail = line.as_chunks::<4>().0.iter().any(|pixel| pixel.iter().zip(first).take(3).any(|(a, b)| (i32::from(*a) - i32::from(*b)).abs() > DETAIL));
            Row { hash, detail }
        })
        .collect()
}

fn fixed_bands(before: &[Row], after: &[Row]) -> Option<(u32, u32)> {
    let height = before.len();
    let top = before.iter().zip(after).take_while(|(a, b)| a == b).count();
    if top == height {
        return None;
    }
    let bottom = before.iter().rev().zip(after.iter().rev()).take_while(|(a, b)| a == b).count();
    let limit = height * 2 / 3;
    let (top, bottom) = if top + bottom > limit { (top.min(limit / 2), bottom.min(limit / 2)) } else { (top, bottom) };
    Some((top as u32, bottom as u32))
}

fn find_shift(before: &[Row], after: &[Row], top: u32, bottom: u32) -> Option<u32> {
    let (start, end) = (top as usize, before.len() - bottom as usize);
    let band = end.saturating_sub(start);
    if band < 8 {
        return None;
    }
    let mut best: Option<(i64, u32)> = None;
    for shift in 1..=(band * 3 / 4) {
        let (mut matches, mut misses) = (0usize, 0usize);
        for y in start..end - shift {
            let old = before[y + shift];
            if !old.detail {
                continue;
            }
            if old.hash == after[y].hash {
                matches += 1;
            } else {
                misses += 1;
            }
        }
        if matches < MIN_MATCHES || misses * 10 > matches {
            continue;
        }
        let score = matches as i64 - 4 * misses as i64;
        if best.is_none_or(|(top_score, _)| score > top_score) {
            best = Some((score, shift as u32));
        }
    }
    best.map(|(_, shift)| shift)
}

impl Stitcher {
    pub(crate) fn new(width: u32, height: u32, first: Vec<u8>) -> Self {
        Self { width, height, fixed: None, rows: rows(&first, width, height), body: Vec::new(), last: first }
    }

    pub(crate) fn height(&self) -> u32 {
        let footer = self.fixed.map_or(0, |(_, bottom)| bottom);
        let body = (self.body.len() / (self.width as usize * 4)) as u32;
        if self.body.is_empty() { self.height } else { body + footer }
    }

    pub(crate) fn push(&mut self, frame: Vec<u8>) -> Step {
        if frame.len() != self.last.len() {
            return Step::Lost;
        }
        let next = rows(&frame, self.width, self.height);
        if next == self.rows {
            return Step::Unchanged;
        }
        let (top, bottom) = match self.fixed {
            Some(bands) => bands,
            None => match fixed_bands(&self.rows, &next) {
                Some(bands) => bands,
                None => return Step::Unchanged,
            },
        };
        let Some(shift) = find_shift(&self.rows, &next, top, bottom) else {
            return Step::Lost;
        };
        let row_bytes = self.width as usize * 4;
        if self.fixed.is_none() {
            self.fixed = Some((top, bottom));
            self.body.extend_from_slice(&self.last[..(self.height - bottom) as usize * row_bytes]);
        }
        let end = (self.height - bottom) as usize;
        self.body.extend_from_slice(&frame[(end - shift as usize) * row_bytes..end * row_bytes]);
        self.rows = next;
        self.last = frame;
        Step::Added(shift)
    }

    pub(crate) fn finish(self) -> (u32, u32, Vec<u8>) {
        let Some((_, bottom)) = self.fixed else {
            return (self.width, self.height, self.last);
        };
        let row_bytes = self.width as usize * 4;
        let mut out = self.body;
        out.extend_from_slice(&self.last[(self.height - bottom) as usize * row_bytes..]);
        let height = (out.len() / row_bytes) as u32;
        (self.width, height, out)
    }
}
