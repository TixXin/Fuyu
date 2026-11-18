use std::{collections::HashMap, str::FromStr};

use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, TimeZone, Utc};
use rrule::{RRule, Tz, Unvalidated};

use super::meeting_link::meeting_link;

const MAX_OCCURRENCES: u16 = 500;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub(super) uid: String,
    pub(super) title: String,
    #[cfg_attr(test, ts(type = "number"))]
    pub(super) start_ms: i64,
    #[cfg_attr(test, ts(type = "number"))]
    pub(super) end_ms: i64,
    pub(super) all_day: bool,
    pub(super) location: Option<String>,
    pub(super) meeting_link: Option<String>,
    pub(super) calendar: String,
    #[serde(default)]
    pub(super) declined: bool,
    #[serde(default)]
    pub(super) free: bool,
}

#[derive(Debug)]
struct Property {
    name: String,
    params: HashMap<String, String>,
    value: String,
}

fn unfold(text: &str) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    for line in text.split('\n').map(|line| line.trim_end_matches('\r')) {
        match (line.strip_prefix([' ', '\t']), lines.last_mut()) {
            (Some(rest), Some(last)) => last.push_str(rest),
            _ if !line.is_empty() => lines.push(line.to_string()),
            _ => {}
        }
    }
    lines
}

fn split_unquoted(text: &str, sep: char) -> Vec<&str> {
    let (mut out, mut start, mut quoted) = (Vec::new(), 0, false);
    for (idx, c) in text.char_indices() {
        if c == '"' {
            quoted = !quoted;
        } else if c == sep && !quoted {
            out.push(&text[start..idx]);
            start = idx + c.len_utf8();
        }
    }
    out.push(&text[start..]);
    out
}

fn property(line: &str) -> Option<Property> {
    let mut quoted = false;
    let split = line.char_indices().find(|&(_, c)| {
        if c == '"' {
            quoted = !quoted;
        }
        c == ':' && !quoted
    })?;
    let (head, value) = (&line[..split.0], &line[split.0 + 1..]);
    let mut parts = split_unquoted(head, ';').into_iter();
    let name = parts.next()?.trim().to_ascii_uppercase();
    let params = parts
        .filter_map(|part| part.split_once('='))
        .map(|(key, value)| (key.trim().to_ascii_uppercase(), value.trim().trim_matches('"').to_string()))
        .collect();
    Some(Property { name, params, value: value.to_string() })
}

fn unescape(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(c) = chars.next() {
        if c != '\\' {
            result.push(c);
            continue;
        }
        match chars.next() {
            Some('n' | 'N') => result.push('\n'),
            Some(other) => result.push(other),
            None => {}
        }
    }
    result.trim().to_string()
}

const WINDOWS_ZONES: &[(&str, &str)] = &[
    ("China Standard Time", "Asia/Shanghai"),
    ("Taipei Standard Time", "Asia/Taipei"),
    ("Singapore Standard Time", "Asia/Singapore"),
    ("Tokyo Standard Time", "Asia/Tokyo"),
    ("Korea Standard Time", "Asia/Seoul"),
    ("India Standard Time", "Asia/Kolkata"),
    ("GMT Standard Time", "Europe/London"),
    ("W. Europe Standard Time", "Europe/Berlin"),
    ("Romance Standard Time", "Europe/Paris"),
    ("Eastern Standard Time", "America/New_York"),
    ("Central Standard Time", "America/Chicago"),
    ("Mountain Standard Time", "America/Denver"),
    ("Pacific Standard Time", "America/Los_Angeles"),
    ("AUS Eastern Standard Time", "Australia/Sydney"),
    ("UTC", "UTC"),
];

pub(super) fn zone(tzid: Option<&str>) -> Tz {
    let Some(tzid) = tzid.map(str::trim).filter(|tzid| !tzid.is_empty()) else {
        return Tz::LOCAL;
    };
    let iana = WINDOWS_ZONES.iter().find(|(windows, _)| windows.eq_ignore_ascii_case(tzid)).map_or(tzid, |(_, iana)| iana);
    let parse = |name: &str| chrono_tz::Tz::from_str(name).ok().map(Tz::Tz);
    parse(iana)
        .or_else(|| {
            let mut parts = iana.rsplit('/');
            let (last, area) = (parts.next()?, parts.next()?);
            parse(&format!("{area}/{last}"))
        })
        .unwrap_or(Tz::LOCAL)
}

fn moment(property: &Property) -> Option<(DateTime<Tz>, bool)> {
    let value = property.value.trim();
    if property.params.get("VALUE").is_some_and(|kind| kind == "DATE") || value.len() == 8 {
        let date = NaiveDate::parse_from_str(value, "%Y%m%d").ok()?;
        return Tz::LOCAL.from_local_datetime(&date.and_hms_opt(0, 0, 0)?).earliest().map(|at| (at, true));
    }
    if let Some(utc) = value.strip_suffix('Z') {
        let naive = NaiveDateTime::parse_from_str(utc, "%Y%m%dT%H%M%S").ok()?;
        return Some((Tz::UTC.from_utc_datetime(&naive), false));
    }
    let naive = NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S").ok()?;
    zone(property.params.get("TZID").map(String::as_str)).from_local_datetime(&naive).earliest().map(|at| (at, false))
}

fn duration(value: &str) -> Option<Duration> {
    let (sign, rest) = match value.trim().strip_prefix('-') {
        Some(rest) => (-1, rest),
        None => (1, value.trim().trim_start_matches('+')),
    };
    let rest = rest.strip_prefix('P')?;
    let (mut total, mut number, mut in_time) = (0i64, 0i64, false);
    for c in rest.chars() {
        match c {
            'T' => in_time = true,
            '0'..='9' => number = number * 10 + i64::from(c as u8 - b'0'),
            'W' => total += number * 7 * 86_400,
            'D' => total += number * 86_400,
            'H' if in_time => total += number * 3600,
            'M' if in_time => total += number * 60,
            'S' if in_time => total += number,
            _ => return None,
        }
        if !c.is_ascii_digit() {
            number = 0;
        }
    }
    Some(Duration::seconds(sign * total))
}

#[derive(Debug)]
struct Attendee {
    value: String,
    cn: Option<String>,
    email: Option<String>,
    declined: bool,
}

fn strip_mailto(text: &str) -> &str {
    let trimmed = text.trim();
    if trimmed.len() >= 7 && trimmed[..7].eq_ignore_ascii_case("mailto:") {
        trimmed[7..].trim()
    } else {
        trimmed
    }
}

fn push_token(tokens: &mut Vec<String>, raw: &str) {
    let token = strip_mailto(raw).trim_matches(['<', '>', '"', '\'']).trim().to_ascii_lowercase();
    if !token.is_empty() && !tokens.contains(&token) {
        tokens.push(token);
    }
}

fn account_tokens(account: Option<&str>) -> Vec<String> {
    let Some(account) = account.map(str::trim).filter(|text| !text.is_empty()) else {
        return Vec::new();
    };
    let mut tokens = Vec::new();
    push_token(&mut tokens, account);
    if let Some((_, rest)) = account.split_once('<') {
        if let Some((inside, _)) = rest.split_once('>') {
            push_token(&mut tokens, inside);
        }
    }
    for part in account.split(|c: char| c.is_whitespace() || matches!(c, '<' | '>' | '"' | '\'' | ',' | ';')) {
        if part.contains('@') {
            push_token(&mut tokens, part);
        }
    }
    tokens
}

impl Attendee {
    fn from_property(property: &Property) -> Self {
        Self {
            value: property.value.trim().to_string(),
            cn: property.params.get("CN").cloned(),
            email: property.params.get("EMAIL").cloned(),
            declined: property.params.get("PARTSTAT").is_some_and(|status| status.eq_ignore_ascii_case("DECLINED")),
        }
    }

    fn matches(&self, tokens: &[String]) -> bool {
        let mut candidates = Vec::new();
        push_token(&mut candidates, &self.value);
        if self.value.starts_with('/') {
            if let Some(seg) = self.value.trim_end_matches('/').rsplit('/').next() {
                push_token(&mut candidates, seg);
            }
        }
        if let Some(email) = &self.email {
            push_token(&mut candidates, email);
        }
        if let Some(cn) = &self.cn {
            push_token(&mut candidates, cn);
            if let Some((_, rest)) = cn.split_once('<') {
                if let Some((inside, _)) = rest.split_once('>') {
                    push_token(&mut candidates, inside);
                }
            }
        }
        tokens.iter().any(|token| candidates.contains(token))
    }
}

#[derive(Debug, Default)]
struct RawEvent {
    uid: String,
    summary: String,
    location: Option<String>,
    description: Option<String>,
    url: Option<String>,
    start: Option<(DateTime<Tz>, bool)>,
    end: Option<DateTime<Tz>>,
    duration: Option<Duration>,
    rrule: Option<String>,
    exdates: Vec<i64>,
    recurrence_id: Option<i64>,
    cancelled: bool,
    transp_free: bool,
    cdo_free: bool,
    attendees: Vec<Attendee>,
}

impl RawEvent {
    fn length(&self, start: &DateTime<Tz>, all_day: bool) -> Duration {
        self.end
            .map(|end| end.signed_duration_since(start))
            .or(self.duration)
            .filter(|length| *length >= Duration::zero())
            .unwrap_or_else(|| if all_day { Duration::days(1) } else { Duration::zero() })
    }

    fn is_declined(&self, tokens: &[String]) -> bool {
        if tokens.is_empty() {
            self.attendees.len() == 1 && self.attendees[0].declined
        } else {
            let matched: Vec<&Attendee> = self.attendees.iter().filter(|attendee| attendee.matches(tokens)).collect();
            !matched.is_empty() && matched.iter().all(|attendee| attendee.declined)
        }
    }

    fn occurrence(&self, start: DateTime<Tz>, all_day: bool, length: Duration, calname: &str, tokens: &[String]) -> CalendarEvent {
        let start_ms = start.timestamp_millis();
        CalendarEvent {
            uid: self.uid.clone(),
            title: self.summary.clone(),
            start_ms,
            end_ms: start_ms + length.num_milliseconds(),
            all_day,
            location: self.location.clone(),
            meeting_link: meeting_link(&[self.url.as_deref(), self.location.as_deref(), self.description.as_deref()]),
            calendar: calname.to_string(),
            declined: self.is_declined(tokens),
            free: self.transp_free || self.cdo_free,
        }
    }
}

fn raw_events(text: &str) -> (String, Vec<RawEvent>) {
    let mut calname = String::new();
    let mut events = Vec::new();
    let mut current: Option<RawEvent> = None;
    let mut nested = 0usize;
    for property in unfold(text).iter().filter_map(|line| property(line)) {
        match (property.name.as_str(), property.value.trim().to_ascii_uppercase().as_str()) {
            ("BEGIN", "VEVENT") => current = Some(RawEvent::default()),
            ("END", "VEVENT") => events.extend(current.take()),
            ("BEGIN", _) if current.is_some() => nested += 1,
            ("END", _) if current.is_some() && nested > 0 => nested -= 1,
            ("X-WR-CALNAME", _) if current.is_none() => {
                let parsed = unescape(&property.value);
                if !parsed.is_empty() {
                    calname = parsed;
                }
            }
            _ => {}
        }
        let Some(event) = current.as_mut().filter(|_| nested == 0) else {
            continue;
        };
        match property.name.as_str() {
            "UID" => event.uid = property.value.trim().to_string(),
            "SUMMARY" => event.summary = unescape(&property.value),
            "LOCATION" => event.location = Some(unescape(&property.value)).filter(|text| !text.is_empty()),
            "DESCRIPTION" => event.description = Some(unescape(&property.value)),
            "URL" => event.url = Some(property.value.trim().to_string()),
            "DTSTART" => event.start = moment(&property),
            "DTEND" => event.end = moment(&property).map(|(at, _)| at),
            "DURATION" => event.duration = duration(&property.value),
            "RRULE" => event.rrule = Some(property.value.trim().to_string()),
            "EXDATE" => {
                for value in property.value.split(',') {
                    let single = Property { name: String::new(), params: property.params.clone(), value: value.to_string() };
                    event.exdates.extend(moment(&single).map(|(at, _)| at.timestamp_millis()));
                }
            }
            "RECURRENCE-ID" => event.recurrence_id = moment(&property).map(|(at, _)| at.timestamp_millis()),
            "STATUS" => event.cancelled = property.value.trim().eq_ignore_ascii_case("CANCELLED"),
            "TRANSP" => event.transp_free = property.value.trim().eq_ignore_ascii_case("TRANSPARENT"),
            "X-MICROSOFT-CDO-BUSYSTATUS" => event.cdo_free = property.value.trim().eq_ignore_ascii_case("FREE"),
            "ATTENDEE" => event.attendees.push(Attendee::from_property(&property)),
            _ => {}
        }
    }
    (calname, events)
}

fn split_until(rule: &str) -> (String, Option<i64>) {
    let mut until = None;
    let parts: Vec<&str> = rule
        .split(';')
        .filter(|part| match part.split_once('=') {
            Some((key, value)) if key.eq_ignore_ascii_case("UNTIL") => {
                let property = Property { name: String::new(), params: HashMap::new(), value: value.to_string() };
                until = moment(&property).map(|(at, all_day)| at.timestamp_millis() + if all_day { 86_399_999 } else { 0 });
                false
            }
            _ => true,
        })
        .collect();
    (parts.join(";"), until)
}

fn repeats(rule: &str, start: DateTime<Tz>, length: Duration, from: DateTime<Utc>, to: DateTime<Utc>) -> Vec<DateTime<Tz>> {
    let (rule, until) = split_until(rule);
    let Ok(set) = rule.parse::<RRule<Unvalidated>>().and_then(|rule| rule.build(start)) else {
        return vec![start];
    };
    let tz = start.timezone();
    let after = (from - length - Duration::seconds(1)).with_timezone(&tz);
    let before = to.with_timezone(&tz);
    set.after(after)
        .before(before)
        .all(MAX_OCCURRENCES)
        .dates
        .into_iter()
        .filter(|at| until.is_none_or(|until| at.timestamp_millis() <= until))
        .collect()
}

pub(super) fn events_between(text: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> Vec<CalendarEvent> {
    events_between_for(text, from, to, None)
}

pub(super) fn events_between_for(text: &str, from: DateTime<Utc>, to: DateTime<Utc>, self_account: Option<&str>) -> Vec<CalendarEvent> {
    let tokens = account_tokens(self_account);
    let (calname, raw) = raw_events(text);
    let overlaps = |event: &CalendarEvent| {
        event.end_ms.max(event.start_ms + 1) > from.timestamp_millis() && event.start_ms < to.timestamp_millis()
    };
    let mut moved: HashMap<&str, Vec<i64>> = HashMap::new();
    for event in raw.iter().filter(|event| event.recurrence_id.is_some()) {
        moved.entry(event.uid.as_str()).or_default().extend(event.recurrence_id);
    }
    let mut events = Vec::new();
    for event in &raw {
        let Some((start, all_day)) = event.start else {
            continue;
        };
        let length = event.length(&start, all_day);
        if event.cancelled {
            continue;
        }
        let starts = match (&event.rrule, event.recurrence_id) {
            (Some(rule), None) => repeats(rule, start, length, from, to),
            _ => vec![start],
        };
        let replaced = moved.get(event.uid.as_str()).filter(|_| event.recurrence_id.is_none());
        for at in starts {
            let ms = at.timestamp_millis();
            if event.exdates.contains(&ms) || replaced.is_some_and(|starts| starts.contains(&ms)) {
                continue;
            }
            let occurrence = event.occurrence(at, all_day, length, &calname, &tokens);
            if overlaps(&occurrence) {
                events.push(occurrence);
            }
        }
    }
    events.sort_by(|a, b| (a.start_ms, &a.title).cmp(&(b.start_ms, &b.title)));
    events
}

#[cfg(test)]
mod tests;
