use std::{
    sync::{
        mpsc::{self, RecvTimeoutError},
        Arc, Mutex, PoisonError,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use super::builtins::Background;

pub(crate) struct Stop(mpsc::Receiver<()>);

impl Stop {
    pub(crate) fn wait(&self, wait: Duration) -> bool {
        !matches!(self.0.recv_timeout(wait), Err(RecvTimeoutError::Timeout))
    }
}

type Run = Arc<dyn Fn(Stop) + Send + Sync>;

pub(crate) struct Worker {
    name: &'static str,
    run: Run,
    thread: Mutex<Option<(mpsc::Sender<()>, JoinHandle<()>)>>,
}

impl Worker {
    pub(crate) fn new(name: &'static str, run: impl Fn(Stop) + Send + Sync + 'static) -> Self {
        Self { name, run: Arc::new(run), thread: Mutex::new(None) }
    }
}

impl Background for Worker {
    fn start(&self) -> Result<(), String> {
        let mut slot = self.thread.lock().unwrap_or_else(PoisonError::into_inner);
        if slot.as_ref().is_some_and(|(_, handle)| !handle.is_finished()) {
            return Ok(());
        }
        if let Some((_, handle)) = slot.take() {
            let _ = handle.join();
        }
        let (stop, wake) = mpsc::channel();
        let run = self.run.clone();
        let handle = thread::Builder::new()
            .name(self.name.into())
            .spawn(move || run(Stop(wake)))
            .map_err(|error| format!("could not start the {} thread: {error}", self.name))?;
        *slot = Some((stop, handle));
        Ok(())
    }

    fn stop(&self) {
        let running = self.thread.lock().unwrap_or_else(PoisonError::into_inner).take();
        if let Some((stop, handle)) = running {
            drop(stop);
            if handle.join().is_err() {
                eprintln!("the {} thread panicked", self.name);
            }
        }
    }

    fn running(&self) -> bool {
        self.thread.lock().unwrap_or_else(PoisonError::into_inner).as_ref().is_some_and(|(_, handle)| !handle.is_finished())
    }
}

#[cfg(test)]
mod tests {
    use std::{
        sync::atomic::{AtomicUsize, Ordering},
        time::Instant,
    };

    use super::*;

    fn counting() -> (Worker, Arc<AtomicUsize>) {
        let runs = Arc::new(AtomicUsize::new(0));
        let seen = runs.clone();
        let worker = Worker::new("test-worker", move |stop| {
            seen.fetch_add(1, Ordering::SeqCst);
            while !stop.wait(Duration::from_secs(30)) {}
        });
        (worker, runs)
    }

    #[test]
    fn stopping_wakes_the_thread_and_waits_for_it_to_end() {
        let (worker, runs) = counting();
        assert!(!worker.running());
        worker.start().unwrap();
        worker.start().unwrap();
        assert!(worker.running());
        let asked = Instant::now();
        worker.stop();
        assert!(asked.elapsed() < Duration::from_secs(5));
        assert!(!worker.running());
        worker.stop();
        worker.start().unwrap();
        assert!(worker.running());
        worker.stop();
        assert_eq!(runs.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn a_thread_that_returned_on_its_own_is_not_running_and_starts_again() {
        let worker = Worker::new("test-worker", |_| {});
        worker.start().unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        while worker.running() && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(5));
        }
        assert!(!worker.running());
        worker.start().unwrap();
        worker.stop();
    }
}
