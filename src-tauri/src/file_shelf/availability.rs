use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::{mpsc, Mutex, PoisonError},
    thread,
    time::{Duration, Instant},
};

const PROBE_DEADLINE: Duration = Duration::from_millis(300);
const REACHABLE_TTL: Duration = Duration::from_secs(15);
const SLOW_VOLUME_BACKOFF: Duration = Duration::from_secs(30);
const MAX_CACHED_VOLUMES: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Presence {
    Present,
    Missing,
    Unreachable,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum CachedVolume {
    Reachable(Instant),
    Slow(Instant),
}

impl CachedVolume {
    fn until(self) -> Instant {
        match self {
            Self::Reachable(until) | Self::Slow(until) => until,
        }
    }
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
    volumes: Mutex<HashMap<String, CachedVolume>>,
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
        self.reachable_roots_with(roots, Instant::now(), |root| Path::new(root).exists())
    }

    fn reachable_roots_with<F>(&self, roots: HashSet<String>, now: Instant, probe: F) -> HashSet<String>
    where
        F: Fn(&str) -> bool + Send + Sync + Clone + 'static,
    {
        let mut reachable = HashSet::new();
        let mut to_probe = Vec::new();
        {
            let mut volumes = self.volumes.lock().unwrap_or_else(PoisonError::into_inner);
            volumes.retain(|_, cached| cached.until() > now);
            for root in roots {
                match volumes.get(&root).copied() {
                    Some(CachedVolume::Reachable(_)) => {
                        reachable.insert(root);
                    }
                    Some(CachedVolume::Slow(_)) => {}
                    None => to_probe.push(root),
                }
            }
        }
        if to_probe.is_empty() {
            return reachable;
        }

        let (sender, receiver) = mpsc::channel();
        let mut pending: HashSet<String> = HashSet::new();
        for root in to_probe {
            let sender = sender.clone();
            let probe = probe.clone();
            pending.insert(root.clone());
            thread::spawn(move || {
                let exists = probe(&root);
                let _ = sender.send((root, exists));
            });
        }
        drop(sender);

        let deadline = Instant::now() + PROBE_DEADLINE;
        let mut freshly_reachable = Vec::new();
        while !pending.is_empty() {
            let Some(left) = deadline.checked_duration_since(Instant::now()) else {
                break;
            };
            match receiver.recv_timeout(left) {
                Ok((root, exists)) => {
                    pending.remove(&root);
                    if exists {
                        reachable.insert(root.clone());
                        freshly_reachable.push(root);
                    }
                }
                Err(_) => break,
            }
        }

        let mut volumes = self.volumes.lock().unwrap_or_else(PoisonError::into_inner);
        for root in freshly_reachable {
            volumes.insert(root, CachedVolume::Reachable(now + REACHABLE_TTL));
        }
        for root in pending {
            volumes.insert(root, CachedVolume::Slow(now + SLOW_VOLUME_BACKOFF));
        }
        if volumes.len() > MAX_CACHED_VOLUMES {
            let mut order: Vec<(String, Instant)> = volumes
                .iter()
                .map(|(root, cached)| (root.clone(), cached.until()))
                .collect();
            order.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));
            for (root, _) in order.into_iter().take(volumes.len() - MAX_CACHED_VOLUMES) {
                volumes.remove(&root);
            }
        }
        reachable
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    #[test]
    fn reachable_volumes_hit_positive_cache_until_ttl_expires() {
        let availability = Availability::default();
        let probes = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&probes);
        let probe = move |_: &str| {
            count.fetch_add(1, Ordering::SeqCst);
            true
        };
        let roots = || HashSet::from([r"c:\".to_string()]);
        let t0 = Instant::now();

        assert!(availability.reachable_roots_with(roots(), t0, probe.clone()).contains(r"c:\"));
        assert_eq!(probes.load(Ordering::SeqCst), 1);

        assert!(availability.reachable_roots_with(roots(), t0 + Duration::from_secs(10), probe.clone()).contains(r"c:\"));
        assert_eq!(probes.load(Ordering::SeqCst), 1);

        assert!(availability.reachable_roots_with(roots(), t0 + REACHABLE_TTL, probe.clone()).contains(r"c:\"));
        assert_eq!(probes.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn volume_cache_is_bounded_by_max_capacity() {
        let availability = Availability::default();
        let t0 = Instant::now();
        let roots: HashSet<String> = (0..(MAX_CACHED_VOLUMES + 6))
            .map(|index| format!(r"\\nas\share-{index:03}\"))
            .collect();
        let reachable = availability.reachable_roots_with(roots, t0, |_| true);
        assert_eq!(reachable.len(), MAX_CACHED_VOLUMES + 6);
        let cached_len = availability.volumes.lock().expect("volumes lock").len();
        assert_eq!(cached_len, MAX_CACHED_VOLUMES);
    }
}
