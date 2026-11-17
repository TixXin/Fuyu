mod cache;
#[cfg(windows)]
mod poller;
mod router;

#[cfg(test)]
mod tests;

#[allow(unused_imports)]
pub(crate) use cache::ToastApp;
#[allow(unused_imports)]
pub(crate) use router::{PollBatch, Subscription, ToastItem, ToastMatcher, ToastPoll};

#[cfg(windows)]
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock, PoisonError,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
use crate::plugin_kernel::{builtins::Background, worker::Worker};
#[cfg(windows)]
use cache::AppInfoCache;
#[cfg(windows)]
use router::Dispatcher;

#[cfg(windows)]
const POLL_INTERVAL: Duration = Duration::from_secs(1);
#[cfg(windows)]
const WAIT_SLICE: Duration = Duration::from_millis(200);

#[cfg(windows)]
struct ToastHub {
    dispatcher: Mutex<Dispatcher>,
    cache: Mutex<AppInfoCache>,
    dirty: AtomicBool,
    worker: Worker,
}

#[cfg(windows)]
static HUB: OnceLock<ToastHub> = OnceLock::new();

#[cfg(windows)]
fn hub() -> &'static ToastHub {
    HUB.get_or_init(|| ToastHub {
        dispatcher: Mutex::new(Dispatcher::default()),
        cache: Mutex::new(AppInfoCache::default()),
        dirty: AtomicBool::new(false),
        worker: Worker::new("toast-notifications", run_loop),
    })
}

#[cfg(windows)]
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|time| time.as_millis() as i64)
        .unwrap_or_default()
}

#[cfg(windows)]
fn run_loop(stop: crate::plugin_kernel::worker::Stop) {
    let mut last_poll: Option<Instant> = None;
    loop {
        let should_poll = hub().dirty.swap(false, Ordering::AcqRel)
            || last_poll.is_none_or(|at| at.elapsed() >= POLL_INTERVAL);
        if should_poll {
            last_poll = Some(Instant::now());
            tick_once();
        }
        if stop.wait(WAIT_SLICE) {
            return;
        }
    }
}

#[cfg(windows)]
fn tick_once() {
    let hub = hub();
    let matchers = {
        let dispatcher = hub
            .dispatcher
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        if !dispatcher.any_enabled() {
            return;
        }
        dispatcher.active_matchers()
    };
    let outcome = {
        let mut cache = hub.cache.lock().unwrap_or_else(PoisonError::into_inner);
        poller::poll_once(&mut cache, &matchers)
    };
    let deliveries = {
        let dispatcher = hub
            .dispatcher
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        dispatcher.dispatch_poll(&outcome)
    };
    for (callback, payload) in deliveries {
        callback(payload);
    }
    let foreground = poller::foreground_executable();
    let activated = {
        let mut dispatcher = hub
            .dispatcher
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        dispatcher.dispatch_foreground(foreground.as_deref())
    };
    if !activated.is_empty() {
        let at = now_ms();
        for callback in activated {
            callback(at);
        }
    }
}

#[cfg(windows)]
pub(crate) fn subscribe(subscription: Subscription) {
    let hub = hub();
    hub.dispatcher
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .subscribe(subscription);
}

#[cfg(windows)]
pub(crate) fn set_enabled(source: &'static str, enabled: bool) {
    let hub = hub();
    let (any_enabled, newly_enabled) = hub
        .dispatcher
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .set_enabled(source, enabled);
    if any_enabled {
        if newly_enabled {
            hub.dirty.store(true, Ordering::Release);
        }
        if let Err(error) = hub.worker.start() {
            eprintln!("failed to start toast-notifications worker: {error}");
        }
    } else {
        hub.worker.stop();
        hub.cache
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clear_active();
    }
}

#[cfg(windows)]
pub(crate) fn is_source_running(source: &'static str) -> bool {
    let hub = hub();
    let enabled = hub
        .dispatcher
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .is_enabled(source);
    enabled && hub.worker.running()
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn recent_apps() -> Vec<ToastApp> {
    hub()
        .cache
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .recent_apps()
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn read_matching(matchers: &[ToastMatcher]) -> Result<PollBatch, String> {
    let mut cache = AppInfoCache::default();
    poller::poll_once(&mut cache, matchers)
}
