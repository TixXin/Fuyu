pub(in crate::plugin_host) use crate::plugin_host::store::WindowRules;

use crate::plugin_host::{host, lock};

pub(super) fn current(plugin_id: &str) -> WindowRules {
    host().map(|host| lock(&host.state).plugins.get(plugin_id).map(|grant| grant.window_rules).unwrap_or_default()).unwrap_or_default()
}
