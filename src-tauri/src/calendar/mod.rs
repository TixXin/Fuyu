mod caldav;
mod ics;
mod meeting_link;
mod sources;

use crate::user_error::UserError;
use plugin_base::host_service;
use std::{
    sync::{Mutex, PoisonError},
    time::{Duration, Instant},
};

use chrono::{DateTime, Datelike, Local, Months, NaiveDate, TimeZone, Utc};
use serde::Serialize;
use tauri::{AppHandle, Manager};

use ics::{events_between, CalendarEvent};
use sources::{CalendarSource, SourceKind, MAX_SOURCES};

const REFRESH_AFTER: Duration = Duration::from_secs(15 * 60);
const MAX_ICS_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceProblem {
    source_id: String,
    message: UserError,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarSnapshot {
    events: Vec<CalendarEvent>,
    problems: Vec<SourceProblem>,
    fetched_at: i64,
    from_ms: i64,
    to_ms: i64,
    source_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct CalendarProblem {
    source_id: String,
    reason: String,
    message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct CalendarEvents {
    events: Vec<CalendarEvent>,
    problems: Vec<CalendarProblem>,
    #[cfg_attr(test, ts(type = "number"))]
    fetched_at: i64,
    #[cfg_attr(test, ts(type = "number"))]
    from_ms: i64,
    #[cfg_attr(test, ts(type = "number"))]
    to_ms: i64,
    source_count: usize,
}

impl From<CalendarSnapshot> for CalendarEvents {
    fn from(snapshot: CalendarSnapshot) -> Self {
        let problems = snapshot
            .problems
            .into_iter()
            .map(|problem| CalendarProblem { reason: reason_of(&problem.message), message: problem.message.to_string(), source_id: problem.source_id })
            .collect();
        Self {
            events: snapshot.events,
            problems,
            fetched_at: snapshot.fetched_at,
            from_ms: snapshot.from_ms,
            to_ms: snapshot.to_ms,
            source_count: snapshot.source_count,
        }
    }
}

fn reason_of(error: &UserError) -> String {
    serde_json::to_value(error)
        .ok()
        .and_then(|value| value.get("code").and_then(serde_json::Value::as_str).map(str::to_owned))
        .unwrap_or_else(|| "failed".to_owned())
}

struct Cached {
    snapshot: CalendarSnapshot,
    at: Instant,
    sources: Vec<CalendarSource>,
}

static CACHE: Mutex<Option<Cached>> = Mutex::new(None);

fn window(now: DateTime<Local>) -> (DateTime<Utc>, DateTime<Utc>) {
    let midnight = |date: NaiveDate| date.and_hms_opt(0, 0, 0).and_then(|naive| Local.from_local_datetime(&naive).earliest()).unwrap_or(now);
    let first = now.date_naive().with_day(1).unwrap_or(now.date_naive());
    let start = first.checked_sub_months(Months::new(1)).unwrap_or(first);
    let end = first.checked_add_months(Months::new(2)).unwrap_or(first);
    (midnight(start).with_timezone(&Utc), midnight(end).with_timezone(&Utc))
}

fn app_dir(app: &AppHandle) -> Result<std::path::PathBuf, UserError> {
    crate::home_dir::fuyu_home(app.path()).map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))
}

fn home_for_host() -> Result<std::path::PathBuf, UserError> {
    crate::home_dir::current()
        .map(std::path::Path::to_path_buf)
        .ok_or_else(|| UserError::new("internal", "Something went wrong inside the island.").detail("the data folder is not set up yet"))
}

pub(super) fn http_error(code: &'static str, message: &'static str, error: reqwest::Error) -> UserError {
    UserError::new(code, message).detail(error.without_url())
}

async fn fetch_ics(link: &str) -> Result<String, UserError> {
    let url = sources::ics_url(link)?;
    let shown = url.to_string();
    download(url).await.map_err(|error| error.redact(&shown).redact(link.trim()))
}

async fn download(url: reqwest::Url) -> Result<String, UserError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(concat!("Fuyu/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| http_error("http.client", "Could not set up the connection.", error))?;
    let response = client.get(url).send().await.map_err(|error| http_error("calendar.unreachable", "Could not reach the calendar.", error))?;
    match response.status().as_u16() {
        401 | 403 | 404 => return Err(UserError::new("calendar.linkExpired", "The subscription link has expired, or does not allow access.")),
        status if !(200..300).contains(&status) => return Err(UserError::new("calendar.status", format!("The calendar answered {status}.")).arg("status", status)),
        _ => {}
    }
    let bytes = response.bytes().await.map_err(|error| http_error("calendar.read", "Could not read the calendar.", error))?;
    if bytes.len() > MAX_ICS_BYTES {
        return Err(UserError::new("calendar.tooLarge", "The calendar is too large."));
    }
    let text = String::from_utf8_lossy(&ungzip(&bytes)?).to_string();
    if !text.contains("BEGIN:VCALENDAR") {
        return Err(UserError::new("calendar.notIcs", "This link is not a calendar (iCalendar)."));
    }
    Ok(text)
}

fn ungzip(bytes: &[u8]) -> Result<Vec<u8>, UserError> {
    use std::io::Read;
    if !bytes.starts_with(&[0x1f, 0x8b]) {
        return Ok(bytes.to_vec());
    }
    let mut unpacked = Vec::new();
    flate2::read::GzDecoder::new(bytes)
        .take(MAX_ICS_BYTES as u64 + 1)
        .read_to_end(&mut unpacked)
        .map_err(|_| UserError::new("calendar.corrupt", "The calendar is damaged."))?;
    if unpacked.len() > MAX_ICS_BYTES {
        return Err(UserError::new("calendar.tooLarge", "The calendar is too large."));
    }
    Ok(unpacked)
}

async fn read_source(source: &CalendarSource, secret: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> Result<Vec<CalendarEvent>, UserError> {
    let texts = match source.kind {
        SourceKind::Ics => vec![fetch_ics(secret).await?],
        SourceKind::Caldav => {
            let account = caldav::Account { url: &source.url, username: &source.username, password: secret };
            caldav::fetch(&account, from, to).await?
        }
    };
    let mut events: Vec<CalendarEvent> = texts.iter().flat_map(|text| events_between(text, from, to)).collect();
    for event in &mut events {
        event.calendar = source.name.clone();
    }
    Ok(events)
}

async fn read_all(sources: &[CalendarSource]) -> CalendarSnapshot {
    let (from, to) = window(Local::now());
    let mut snapshot = CalendarSnapshot {
        fetched_at: Utc::now().timestamp_millis(),
        from_ms: from.timestamp_millis(),
        to_ms: to.timestamp_millis(),
        source_count: sources.len(),
        ..CalendarSnapshot::default()
    };
    for source in sources {
        let result = match sources::read_secret(&source.id) {
            Ok(Some(secret)) => read_source(source, &secret, from, to).await,
            Ok(None) => Err(UserError::new("calendar.secretMissing", "The saved password or link is missing; remove this calendar and add it again.")),
            Err(error) => Err(error),
        };
        match result {
            Ok(events) => snapshot.events.extend(events),
            Err(message) => snapshot.problems.push(SourceProblem { source_id: source.id.clone(), message }),
        }
    }
    snapshot.events.sort_by(|a, b| (a.start_ms, &a.uid).cmp(&(b.start_ms, &b.uid)));
    snapshot.events.dedup_by(|a, b| a.uid == b.uid && a.start_ms == b.start_ms);
    snapshot
}

#[tauri::command]
pub async fn get_calendar_events(app: AppHandle, refresh: bool) -> Result<CalendarSnapshot, UserError> {
    read_events(&app_dir(&app)?, refresh).await
}

#[host_service("calendar.events", timeout_ms = 60_000)]
async fn events_for_host(refresh: Option<bool>) -> Result<CalendarEvents, UserError> {
    read_events(&home_for_host()?, refresh.unwrap_or(false)).await.map(CalendarEvents::from)
}

async fn read_events(dir: &std::path::Path, refresh: bool) -> Result<CalendarSnapshot, UserError> {
    let sources = sources::read(dir);
    if sources.is_empty() {
        return Ok(CalendarSnapshot::default());
    }
    {
        let cache = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(cached) = cache.as_ref().filter(|cached| !refresh && cached.sources == sources && cached.at.elapsed() < REFRESH_AFTER) {
            return Ok(cached.snapshot.clone());
        }
    }
    let snapshot = read_all(&sources).await;
    *CACHE.lock().unwrap_or_else(PoisonError::into_inner) = Some(Cached { snapshot: snapshot.clone(), at: Instant::now(), sources });
    Ok(snapshot)
}

#[tauri::command]
pub fn list_calendar_sources(app: AppHandle) -> Result<Vec<CalendarSource>, UserError> {
    Ok(sources::read(&app_dir(&app)?))
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub(crate) struct CalendarSourceInfo {
    id: String,
    kind: &'static str,
    name: String,
    host: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub(crate) struct CalendarSources {
    sources: Vec<CalendarSourceInfo>,
}

impl From<Vec<CalendarSource>> for CalendarSources {
    fn from(saved: Vec<CalendarSource>) -> Self {
        let sources = saved
            .into_iter()
            .map(|source| CalendarSourceInfo {
                kind: match source.kind {
                    SourceKind::Ics => "ics",
                    SourceKind::Caldav => "caldav",
                },
                id: source.id,
                name: source.name,
                host: source.host,
            })
            .collect();
        Self { sources }
    }
}

#[host_service("calendar.sources")]
fn sources_for_host() -> Result<CalendarSources, UserError> {
    Ok(sources::read(&home_for_host()?).into())
}

#[tauri::command]
pub async fn add_calendar_source(
    app: AppHandle,
    kind: SourceKind,
    name: String,
    url: String,
    username: String,
    secret: String,
) -> Result<CalendarSource, UserError> {
    let dir = app_dir(&app)?;
    let mut saved = sources::read(&dir);
    if saved.len() >= MAX_SOURCES {
        return Err(UserError::new("calendar.tooMany", format!("At most {MAX_SOURCES} calendars.")).arg("max", MAX_SOURCES));
    }
    let secret = secret.trim().to_string();
    if secret.is_empty() {
        return Err(if kind == SourceKind::Ics {
            UserError::new("calendar.needLink", "Fill in the subscription link.")
        } else {
            UserError::new("calendar.needPassword", "Fill in the password.")
        });
    }
    let (url, host) = match kind {
        SourceKind::Ics => (String::new(), sources::ics_url(&secret)?.host_str().unwrap_or_default().to_string()),
        SourceKind::Caldav => {
            if username.trim().is_empty() {
                return Err(UserError::new("calendar.needAccount", "Fill in the account."));
            }
            (url.trim().to_string(), sources::host_of(&url))
        }
    };
    let name = Some(name.trim().chars().take(40).collect::<String>()).filter(|name| !name.is_empty()).unwrap_or_else(|| host.clone());
    let source = CalendarSource {
        id: format!("cal-{}", Utc::now().timestamp_millis()),
        kind,
        name,
        url,
        host,
        username: username.trim().to_string(),
    };
    let (from, to) = window(Local::now());
    read_source(&source, &secret, from, to).await?;
    sources::save_secret(&source.id, &secret)?;
    saved.push(source.clone());
    sources::write(&dir, &saved)?;
    Ok(source)
}

#[tauri::command]
pub fn remove_calendar_source(app: AppHandle, id: String) -> Result<(), UserError> {
    let dir = app_dir(&app)?;
    let mut saved = sources::read(&dir);
    saved.retain(|source| source.id != id);
    sources::write(&dir, &saved)?;
    sources::delete_secret(&id)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::calendar::get_calendar_events,
            crate::calendar::list_calendar_sources,
            crate::calendar::add_calendar_source,
            crate::calendar::remove_calendar_source,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gzip_bodies_are_unpacked_and_others_kept() {
        use std::io::Write;
        let mut packed = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        packed.write_all(b"BEGIN:VCALENDAR").unwrap();
        assert_eq!(ungzip(&packed.finish().unwrap()).unwrap(), b"BEGIN:VCALENDAR");
        assert_eq!(ungzip(b"BEGIN:VCALENDAR").unwrap(), b"BEGIN:VCALENDAR");
        assert!(ungzip(&[0x1f, 0x8b, 0, 0]).is_err());
    }

    #[test]
    fn a_failed_subscription_never_shows_the_link() {
        let link = "webcal://127.0.0.1:1/calendar/ical/private-s3cr3t-token/basic.ics";
        let error = tauri::async_runtime::block_on(fetch_ics(link)).unwrap_err();
        assert_eq!(error.code(), "calendar.unreachable");
        let shown = serde_json::to_string(&error).unwrap() + &error.to_string();
        assert!(!shown.contains("s3cr3t") && !shown.contains("/calendar/ical"), "{shown}");
    }

    #[test]
    fn a_link_echoed_back_is_hidden() {
        let link = "https://example.com/private-s3cr3t/basic.ics";
        let error = UserError::new("calendar.read", "Could not read.").detail(format!("for url ({link})")).redact(link);
        assert!(!serde_json::to_string(&error).unwrap().contains("s3cr3t"));
    }

    #[test]
    fn the_host_reads_each_problem_as_its_reason_and_message() {
        let snapshot = CalendarSnapshot {
            problems: vec![SourceProblem { source_id: "cal-1".into(), message: UserError::new("calendar.linkExpired", "The link has expired.") }],
            fetched_at: 5,
            source_count: 1,
            ..CalendarSnapshot::default()
        };
        let events = serde_json::to_value(CalendarEvents::from(snapshot)).unwrap();
        assert_eq!(events["problems"], serde_json::json!([{ "sourceId": "cal-1", "reason": "calendar.linkExpired", "message": "The link has expired." }]));
        assert_eq!((events["fetchedAt"].as_i64(), events["sourceCount"].as_u64()), (Some(5), Some(1)));
    }

    #[test]
    fn the_host_sees_each_calendar_without_its_account_or_address() {
        let saved = CalendarSource {
            id: "cal-1".into(),
            kind: SourceKind::Caldav,
            name: "Work".into(),
            url: "https://dav.example/me/".into(),
            host: "dav.example".into(),
            username: "me@example.com".into(),
        };
        let shown = serde_json::to_value(CalendarSources::from(vec![saved])).unwrap();
        assert_eq!(shown, serde_json::json!({ "sources": [{ "id": "cal-1", "kind": "caldav", "name": "Work", "host": "dav.example" }] }));
    }

    #[test]
    fn the_calendar_has_no_background_in_rust() {
        let catalog = crate::plugin_kernel::builtins::catalog();
        let calendar = catalog.iter().find(|plugin| plugin.id == "calendar").expect("calendar is a built-in plugin");
        assert_eq!(calendar.background.as_deref(), Some(&[][..]));
    }

    #[test]
    fn the_window_runs_from_last_month_to_next_month() {
        let local = |y, m, d| Local.with_ymd_and_hms(y, m, d, 0, 0, 0).unwrap().with_timezone(&Utc);
        let (from, to) = window(Local.with_ymd_and_hms(2026, 11, 7, 15, 30, 0).unwrap());
        assert_eq!((from, to), (local(2026, 10, 1), local(2027, 1, 1)));
        let (from, to) = window(Local.with_ymd_and_hms(2027, 1, 31, 23, 0, 0).unwrap());
        assert_eq!((from, to), (local(2026, 12, 1), local(2027, 3, 1)));
    }
}
