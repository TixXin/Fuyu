use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::{mpsc, Mutex, PoisonError},
    thread,
    time::{Duration, Instant},
};

const PROBE_DEADLINE: Duration = Duration::from_millis(300);
const SLOW_VOLUME_BACKOFF: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Presence {
    Present,
    Missing,
    Unreachable,
}

pub(super) fn volume_root(path: &str) -> Option<String> {
    let path = path.replace('/', "\\").to_lowercase();
    if let Some(rest) = path.strip_prefix(r"\\") {
        let mut parts = rest.split('\\').filter(|part| !part.is_empty());
        let (server, share) = (parts.next()?, parts.next()?);
        return Some(format!(r"\\{server}\{share}\"));
    }
    let bytes = path.as_bytes();
    (bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':')
        .then(|| format!(r"{}\", &path[..2]))
}

#[derive(Default)]
pub(super) struct Availability {
    slow_until: Mutex<HashMap<String, Instant>>,
}

impl Availability {
    pub(super) fn check(&self, paths: &[String]) -> HashMap<String, Presence> {
        let roots: HashSet<String> = paths.iter().filter_map(|path| volume_root(path)).collect();
        let reachable = self.reachable_roots(roots);
        paths
            .iter()
            .map(|path| {
                let presence = match volume_root(path) {
                    Some(root) if !reachable.contains(&root) => Presence::Unreachable,
                    _ if Path::new(path).exists() => Presence::Present,
                    _ => Presence::Missing,
                };
                (path.clone(), presence)
            })
            .collect()
    }

    fn reachable_roots(&self, roots: HashSet<String>) -> HashSet<String> {
        let now = Instant::now();
        let mut slow_until = self.slow_until.lock().unwrap_or_else(PoisonError::into_inner);
        slow_until.retain(|_, until| *until > now);

        let (sender, receiver) = mpsc::channel();
        let mut pending: HashSet<String> = HashSet::new();
        for root in roots.into_iter().filter(|root| !slow_until.contains_key(root)) {
            let sender = sender.clone();
            pending.insert(root.clone());
            thread::spawn(move || {
                let exists = Path::new(&root).exists();
                let _ = sender.send((root, exists));
            });
        }
        drop(sender);

        let deadline = now + PROBE_DEADLINE;
        let mut reachable = HashSet::new();
        while !pending.is_empty() {
            let Some(left) = deadline.checked_duration_since(Instant::now()) else {
                break;
            };
            match receiver.recv_timeout(left) {
                Ok((root, exists)) => {
                    pending.remove(&root);
                    if exists {
                        reachable.insert(root);
                    }
                }
                Err(_) => break,
            }
        }
        for root in pending {
            slow_until.insert(root, now + SLOW_VOLUME_BACKOFF);
        }
        reachable
    }
}
