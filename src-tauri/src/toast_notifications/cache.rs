use std::collections::{HashMap, HashSet};

const MAX_RECENT_APPS: usize = 100;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ToastApp {
    pub(crate) aumid: String,
    pub(crate) display_name: String,
}

#[derive(Default)]
pub(crate) struct AppInfoCache {
    by_id: HashMap<u32, Option<ToastApp>>,
    recent: Vec<ToastApp>,
}

impl AppInfoCache {
    pub(crate) fn resolve(
        &mut self,
        id: u32,
        fetch: impl FnOnce() -> Option<ToastApp>,
    ) -> Option<ToastApp> {
        if let Some(cached) = self.by_id.get(&id) {
            return cached.clone();
        }
        let resolved = fetch();
        if let Some(ref app) = resolved {
            if !app.aumid.trim().is_empty() {
                self.record_recent(app.clone());
            }
        }
        self.by_id.insert(id, resolved.clone());
        resolved
    }

    pub(crate) fn retain_active(&mut self, active_ids: &HashSet<u32>) {
        self.by_id.retain(|id, _| active_ids.contains(id));
    }

    pub(crate) fn clear_active(&mut self) {
        self.by_id.clear();
    }

    pub(crate) fn recent_apps(&self) -> Vec<ToastApp> {
        self.recent.clone()
    }

    #[cfg(test)]
    pub(crate) fn active_len(&self) -> usize {
        self.by_id.len()
    }

    fn record_recent(&mut self, mut app: ToastApp) {
        if let Some(existing) = self
            .recent
            .iter()
            .position(|item| item.aumid.eq_ignore_ascii_case(&app.aumid))
        {
            let previous = self.recent.remove(existing);
            if app.display_name.trim().is_empty() && !previous.display_name.trim().is_empty() {
                app.display_name = previous.display_name;
            }
        }
        self.recent.insert(0, app);
        self.recent.truncate(MAX_RECENT_APPS);
    }
}
