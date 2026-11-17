use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc, Arc, Mutex, OnceLock, PoisonError,
    },
    thread::{self, JoinHandle},
    time::Duration,
};
use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::WM_QUIT};

use super::source::{
    route_multi_signals, ReminderListener, ReminderSignal, ShellMatcher, TargetWindow,
};
use crate::win32::message_window;

const START_TIMEOUT: Duration = Duration::from_secs(5);

type SignalCallback = Arc<dyn Fn(ReminderSignal) + Send + Sync>;

struct Subscriber {
    id: u64,
    matcher: ShellMatcher,
    callback: SignalCallback,
}

struct RunningLoop {
    hwnd: isize,
    handle: JoinHandle<()>,
}

struct ShellHub {
    runtime: Mutex<Option<RunningLoop>>,
    subscribers: Mutex<Vec<Subscriber>>,
    next_id: AtomicU64,
}

static HUB: OnceLock<ShellHub> = OnceLock::new();

fn hub() -> &'static ShellHub {
    HUB.get_or_init(|| ShellHub {
        runtime: Mutex::new(None),
        subscribers: Mutex::new(Vec::new()),
        next_id: AtomicU64::new(1),
    })
}

pub(crate) struct ShellSubscription {
    id: u64,
}

impl Drop for ShellSubscription {
    fn drop(&mut self) {
        unsubscribe(self.id);
    }
}

pub(crate) fn subscribe(
    matcher: ShellMatcher,
    callback: impl Fn(ReminderSignal) + Send + Sync + 'static,
) -> Result<ShellSubscription, String> {
    let hub = hub();
    let id = hub.next_id.fetch_add(1, Ordering::Relaxed);
    let mut runtime = hub.runtime.lock().unwrap_or_else(PoisonError::into_inner);
    if runtime
        .as_ref()
        .is_some_and(|running| running.handle.is_finished())
    {
        if let Some(finished) = runtime.take() {
            let _ = finished.handle.join();
        }
    }
    if runtime.is_none() {
        *runtime = Some(start_thread()?);
    }
    hub.subscribers
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .push(Subscriber {
            id,
            matcher,
            callback: Arc::new(callback),
        });
    Ok(ShellSubscription { id })
}

#[allow(dead_code)]
pub(crate) fn subscribe_executables(
    names: &[&str],
    callback: impl Fn(ReminderSignal) + Send + Sync + 'static,
) -> Result<ShellSubscription, String> {
    subscribe(ShellMatcher::file_names(names), callback)
}

#[allow(dead_code)]
pub(crate) fn is_running() -> bool {
    hub()
        .runtime
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .as_ref()
        .is_some_and(|running| !running.handle.is_finished())
}

fn unsubscribe(id: u64) {
    let hub = hub();
    let stopped = {
        let mut runtime = hub.runtime.lock().unwrap_or_else(PoisonError::into_inner);
        let empty = {
            let mut subscribers = hub
                .subscribers
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            subscribers.retain(|entry| entry.id != id);
            subscribers.is_empty()
        };
        if empty {
            runtime.take()
        } else {
            None
        }
    };
    if let Some(running) = stopped {
        let _ = message_window::post_message(HWND(running.hwnd as *mut _), WM_QUIT);
        if running.handle.thread().id() != thread::current().id() {
            let _ = running.handle.join();
        }
    }
}

fn start_thread() -> Result<RunningLoop, String> {
    let (ready_tx, ready_rx) = mpsc::sync_channel::<Result<isize, String>>(1);
    let handle = thread::Builder::new()
        .name("shell-attention".into())
        .spawn(move || {
            let listener = ReminderListener::raw(|signal, target, foreground| {
                dispatch(signal, &target, foreground.as_deref());
            });
            match listener {
                Ok(listener) => {
                    let _ = ready_tx.send(Ok(listener.hwnd().0 as isize));
                    message_window::run_message_loop();
                    listener.poll();
                    drop(listener);
                }
                Err(error) => {
                    let _ = ready_tx.send(Err(error));
                }
            }
        })
        .map_err(|error| format!("无法启动任务栏提醒监听线程：{error}"))?;
    match ready_rx.recv_timeout(START_TIMEOUT) {
        Ok(Ok(hwnd)) => Ok(RunningLoop { hwnd, handle }),
        Ok(Err(error)) => {
            let _ = handle.join();
            Err(error)
        }
        Err(error) => Err(format!("任务栏提醒监听线程启动超时：{error}")),
    }
}

fn dispatch(signal: ReminderSignal, target: &TargetWindow, foreground: Option<&str>) {
    let snapshot: Vec<(ShellMatcher, SignalCallback)> = hub()
        .subscribers
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .iter()
        .map(|entry| (entry.matcher.clone(), entry.callback.clone()))
        .collect();
    if snapshot.is_empty() {
        return;
    }
    let deliveries = route_multi_signals(
        signal,
        target,
        foreground,
        snapshot
            .iter()
            .enumerate()
            .map(|(index, (matcher, _))| (index, matcher)),
    );
    for (index, routed) in deliveries {
        if let Some((_, callback)) = snapshot.get(index) {
            callback(routed);
        }
    }
}
