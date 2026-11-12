use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

use super::{update_entry, Context};

const TRACE_LINES: usize = 200;
const MAX_TRACE_CHARS: usize = 2000;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEntry {
    pub at: u64,
    pub outgoing: bool,
    pub text: String,
}

pub(super) fn record(context: &Context, outgoing: bool, line: &str) {
    if !context.spec.dev {
        return;
    }
    let at = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX));
    let mut text: String = line.chars().take(MAX_TRACE_CHARS).collect();
    if text.len() < line.len() {
        text.push('…');
    }
    update_entry(context, |info| {
        info.trace.push_back(TraceEntry { at, outgoing, text });
        while info.trace.len() > TRACE_LINES {
            info.trace.pop_front();
        }
    });
}
