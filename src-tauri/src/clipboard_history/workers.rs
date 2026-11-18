use std::{
    sync::{
        mpsc::{self, RecvTimeoutError, Sender, SyncSender},
        Mutex, PoisonError,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use super::service;

pub(super) struct Ticker {
    stop: Sender<()>,
    handle: JoinHandle<()>,
}

impl Ticker {
    pub(super) fn spawn(name: &str, interval: Duration, mut tick: impl FnMut() + Send + 'static) -> Result<Self, String> {
        let (stop, stopped) = mpsc::channel::<()>();
        let handle = thread::Builder::new()
            .name(name.into())
            .spawn(move || loop {
                match stopped.recv_timeout(interval) {
                    Err(RecvTimeoutError::Timeout) => tick(),
                    _ => return,
                }
            })
            .map_err(|error| format!("Could not start {name}: {error}"))?;
        Ok(Self { stop, handle })
    }

    pub(super) fn stop(self) {
        drop(self.stop);
        let _ = self.handle.join();
    }

    pub(super) fn alive(&self) -> bool {
        !self.handle.is_finished()
    }
}

static NOTIFY: Mutex<Option<SyncSender<()>>> = Mutex::new(None);
static CAPTURE: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);

pub(super) fn start_capture() -> Result<(), String> {
    let mut slot = CAPTURE.lock().unwrap_or_else(PoisonError::into_inner);
    if slot.as_ref().is_some_and(|handle| !handle.is_finished()) {
        return Ok(());
    }
    let (notify, notified) = mpsc::sync_channel::<()>(1);
    let handle = thread::Builder::new()
        .name("clipboard-capture".into())
        .spawn(move || {
            while notified.recv().is_ok() {
                if let Ok(service) = service() {
                    service.capture_current_clipboard();
                }
            }
        })
        .map_err(|error| format!("Could not start the clipboard capture: {error}"))?;
    *NOTIFY.lock().unwrap_or_else(PoisonError::into_inner) = Some(notify);
    *slot = Some(handle);
    Ok(())
}

pub(super) fn stop_capture() {
    NOTIFY.lock().unwrap_or_else(PoisonError::into_inner).take();
    let handle = CAPTURE.lock().unwrap_or_else(PoisonError::into_inner).take();
    if let Some(handle) = handle {
        let _ = handle.join();
    }
}

pub(super) fn capture_running() -> bool {
    CAPTURE.lock().unwrap_or_else(PoisonError::into_inner).as_ref().is_some_and(|handle| !handle.is_finished())
}

pub(super) async fn run_blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work).await.map_err(|error| format!("Failed to join clipboard task: {error}"))?
}

pub(super) fn notify_clipboard_changed() {
    let sender = NOTIFY.lock().unwrap_or_else(PoisonError::into_inner).clone();
    if let Some(sender) = sender {
        let _ = sender.try_send(());
    }
}

#[cfg(test)]
mod tests {
    use std::{
        sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        },
        time::Duration,
    };

    use super::Ticker;

    #[test]
    fn a_ticker_ticks_until_it_is_stopped() {
        let ticks = Arc::new(AtomicUsize::new(0));
        let counted = ticks.clone();
        let ticker = Ticker::spawn("test-ticker", Duration::from_millis(5), move || {
            counted.fetch_add(1, Ordering::SeqCst);
        })
        .expect("the ticker starts");
        while ticks.load(Ordering::SeqCst) < 2 {
            std::thread::sleep(Duration::from_millis(2));
        }
        assert!(ticker.alive());
        ticker.stop();
        let stopped_at = ticks.load(Ordering::SeqCst);
        std::thread::sleep(Duration::from_millis(30));
        assert_eq!(ticks.load(Ordering::SeqCst), stopped_at);
    }
}
