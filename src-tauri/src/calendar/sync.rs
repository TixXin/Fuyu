use super::{read_source, sources, window, window_for, CalendarSnapshot, SourceProblem, REFRESH_AFTER};
use crate::user_error::UserError;
use chrono::{Local, Utc};
use sources::{CalendarSource, SourceKind};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    sync::{Arc, Condvar, Mutex, MutexGuard, PoisonError},
    time::{Duration, Instant},
};

const WAIT: Duration = Duration::from_secs(40);
const STUCK_AFTER: Duration = Duration::from_secs(10 * 60);

struct Cached {
    snapshot: CalendarSnapshot,
    at: Instant,
    sources: Vec<CalendarSource>,
}

struct Round {
    started: Instant,
    done: Mutex<Option<CalendarSnapshot>>,
    ready: Condvar,
}

static CACHE: Mutex<Option<Cached>> = Mutex::new(None);
static ROUND: Mutex<Option<Arc<Round>>> = Mutex::new(None);
static SYNCED: Mutex<BTreeMap<String, i64>> = Mutex::new(BTreeMap::new());

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) async fn read_events(dir: &Path, refresh: bool) -> Result<CalendarSnapshot, UserError> {
    let sources = sources::read(dir)?;
    if sources.is_empty() {
        return Ok(CalendarSnapshot::default());
    }
    if !refresh {
        if let Some(cached) = lock(&CACHE).as_ref().filter(|cached| cached.sources == sources && cached.at.elapsed() < REFRESH_AFTER) {
            return Ok(with_sync(cached.snapshot.clone()));
        }
    }
    let round = start(dir.to_path_buf(), sources.clone(), refresh);
    let finished = tauri::async_runtime::spawn_blocking(move || wait(&round, WAIT)).await.ok().flatten();
    Ok(with_sync(finished.unwrap_or_else(|| pending(&sources))))
}

fn start(dir: PathBuf, sources: Vec<CalendarSource>, retry: bool) -> Arc<Round> {
    let mut current = lock(&ROUND);
    if let Some(round) = current.as_ref().filter(|round| round.started.elapsed() < STUCK_AFTER) {
        return round.clone();
    }
    let round = Arc::new(Round { started: Instant::now(), done: Mutex::new(None), ready: Condvar::new() });
    *current = Some(round.clone());
    let shared = round.clone();
    tauri::async_runtime::spawn(async move {
        let mut sources = sources;
        let (snapshot, changed) = read_all(&mut sources, retry).await;
        let sources = if changed { save_discovered(&dir, &sources).unwrap_or(sources) } else { sources };
        remember(&snapshot, &sources, Utc::now().timestamp_millis());
        *lock(&CACHE) = Some(Cached { snapshot: snapshot.clone(), at: Instant::now(), sources });
        let mut current = lock(&ROUND);
        if current.as_ref().is_some_and(|round| Arc::ptr_eq(round, &shared)) {
            *current = None;
        }
        drop(current);
        *lock(&shared.done) = Some(snapshot);
        shared.ready.notify_all();
    });
    round
}

fn wait(round: &Round, limit: Duration) -> Option<CalendarSnapshot> {
    let done = lock(&round.done);
    let (done, _) = round.ready.wait_timeout_while(done, limit, |done| done.is_none()).unwrap_or_else(PoisonError::into_inner);
    done.clone()
}

fn save_discovered(dir: &Path, read: &[CalendarSource]) -> Option<Vec<CalendarSource>> {
    let mut saved = sources::read(dir).ok()?;
    for source in &mut saved {
        if let Some(found) = read.iter().find(|found| found.id == source.id) {
            source.calendars.clone_from(&found.calendars);
        }
    }
    sources::write(dir, &saved).ok()?;
    Some(saved)
}

fn remember(snapshot: &CalendarSnapshot, sources: &[CalendarSource], at: i64) {
    let mut synced = lock(&SYNCED);
    synced.retain(|id, _| sources.iter().any(|source| &source.id == id));
    for source in sources {
        if !snapshot.problems.iter().any(|problem| problem.source_id == source.id) {
            synced.insert(source.id.clone(), at);
        }
    }
}

fn with_sync(mut snapshot: CalendarSnapshot) -> CalendarSnapshot {
    snapshot.synced = lock(&SYNCED).clone();
    snapshot.refresh_every_ms = REFRESH_AFTER.as_millis() as i64;
    snapshot
}

fn pending(sources: &[CalendarSource]) -> CalendarSnapshot {
    if let Some(cached) = lock(&CACHE).as_ref() {
        return CalendarSnapshot { source_count: sources.len(), ..cached.snapshot.clone() };
    }
    syncing(sources)
}

fn syncing(sources: &[CalendarSource]) -> CalendarSnapshot {
    let (from, to) = window(Local::now());
    CalendarSnapshot {
        problems: sources
            .iter()
            .map(|source| SourceProblem {
                source_id: source.id.clone(),
                message: UserError::new("calendar.syncing", "Still syncing; this calendar is slow to answer."),
            })
            .collect(),
        from_ms: from.timestamp_millis(),
        to_ms: to.timestamp_millis(),
        source_count: sources.len(),
        ..CalendarSnapshot::default()
    }
}

async fn secret_of(id: &str, retry: bool) -> Result<Option<String>, UserError> {
    let id = id.to_string();
    tauri::async_runtime::spawn_blocking(move || sources::read_secret(&id, retry))
        .await
        .unwrap_or_else(|error| Err(UserError::new("internal", "Something went wrong inside the island.").detail(error)))
}

async fn read_one(source: CalendarSource, retry: bool) -> Result<(Vec<super::CalendarEvent>, Vec<sources::SubCalendar>), UserError> {
    match secret_of(&source.id, retry).await? {
        Some(secret) => {
            let (from, to) = window_for(&source, Local::now());
            read_source(&source, &secret, from, to).await
        }
        None => Err(UserError::new("calendar.secretMissing", "The saved password or link is missing; remove this calendar and add it again.")),
    }
}

async fn read_all(sources: &mut [CalendarSource], retry: bool) -> (CalendarSnapshot, bool) {
    let (from, to) = window(Local::now());
    let mut snapshot = CalendarSnapshot {
        fetched_at: Utc::now().timestamp_millis(),
        from_ms: from.timestamp_millis(),
        to_ms: to.timestamp_millis(),
        source_count: sources.len(),
        ..CalendarSnapshot::default()
    };
    let tasks: Vec<_> = sources.iter().cloned().map(|source| tauri::async_runtime::spawn(read_one(source, retry))).collect();
    let mut changed = false;
    for (source, task) in sources.iter_mut().zip(tasks) {
        let result = task.await.unwrap_or_else(|error| Err(UserError::new("internal", "Something went wrong inside the island.").detail(error)));
        match result {
            Ok((events, calendars)) => {
                if source.kind == SourceKind::Caldav && !calendars.is_empty() && source.calendars != calendars {
                    source.calendars = calendars;
                    changed = true;
                }
                for sub in &source.calendars {
                    if let Some(color) = &sub.color {
                        snapshot.calendar_colors.entry(sub.name.clone()).or_insert_with(|| color.clone());
                    }
                }
                snapshot.events.extend(events);
            }
            Err(message) => snapshot.problems.push(SourceProblem { source_id: source.id.clone(), message }),
        }
    }
    snapshot.events.sort_by(|a, b| (a.start_ms, &a.uid).cmp(&(b.start_ms, &b.uid)));
    snapshot.events.dedup_by(|a, b| a.uid == b.uid && a.start_ms == b.start_ms);
    snapshot.fetched_at = Utc::now().timestamp_millis();
    (snapshot, changed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn source(id: &str) -> CalendarSource {
        CalendarSource { id: id.into(), kind: SourceKind::Ics, name: id.into(), url: String::new(), host: "h".into(), username: String::new(), calendars: Vec::new() }
    }

    #[test]
    fn a_slow_first_sync_still_counts_every_calendar() {
        let shown = syncing(&[source("a"), source("b")]);
        assert_eq!(shown.source_count, 2);
        assert!(shown.problems.iter().all(|problem| problem.message.code() == "calendar.syncing"));
        assert!(shown.to_ms > shown.from_ms);
    }

    #[test]
    fn a_round_that_never_ends_lets_the_caller_go() {
        let round = Round { started: Instant::now(), done: Mutex::new(None), ready: Condvar::new() };
        assert!(wait(&round, Duration::from_millis(10)).is_none());
        *lock(&round.done) = Some(CalendarSnapshot { source_count: 1, ..CalendarSnapshot::default() });
        assert_eq!(wait(&round, Duration::from_millis(10)).map(|snapshot| snapshot.source_count), Some(1));
    }

    #[test]
    fn only_calendars_read_without_a_problem_get_a_new_sync_time() {
        let snapshot = CalendarSnapshot {
            problems: vec![SourceProblem { source_id: "sync-b".into(), message: UserError::new("calendar.unreachable", "x") }],
            ..CalendarSnapshot::default()
        };
        remember(&snapshot, &[source("sync-a"), source("sync-b")], 7);
        let synced = lock(&SYNCED).clone();
        assert_eq!((synced.get("sync-a"), synced.get("sync-b")), (Some(&7), None));
    }
}
